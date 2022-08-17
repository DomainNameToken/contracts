/// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Destroyable} from "./Destroyable.sol";
import {ICustodian} from "./interfaces/ICustodian.sol";
import {IDomain} from "./interfaces/IDomain.sol";
import {DataStructs} from "./libraries/DataStructs.sol";
import {OrderInfo} from "./libraries/OrderInfo.sol";
import {Order} from "./libraries/Order.sol";

/// @title AcquisitionManagerImplementation
/// @notice Domain token acquisition manager contract. Order the minting or extension of a domain token
contract AcquisitionManagerImplementation is Destroyable, Initializable {
  using OrderInfo for DataStructs.OrderInfo;
  using Order for DataStructs.Order;
  using Counters for Counters.Counter;
  using EnumerableMap for EnumerableMap.AddressToUintMap;
  // The custodian contract address
  ICustodian public custodian;
  // The domain token contract address
  IDomain public domainToken;
  // Counter for order ids
  Counters.Counter private _nextOrderId;

  // Index of active orders for each token id
  mapping(uint256 => uint256) public book;

  // Index of all orders ids requested by an user
  mapping(address => uint256[]) public userOrders;

  // Index of all orders information by order id
  mapping(uint256 => DataStructs.Order) public orders;

  // mapping of all prices associated with each tld
  mapping(bytes32 => uint256) public standardPrices;

  // number of decimals for standard prices
  uint256 public standardPriceDecimals;

  // list of all accepted stable tokens
  EnumerableMap.AddressToUintMap private acceptedStableTokens;

  // Oracle address for native price in USD
  AggregatorV3Interface public nativeChainlinkAggregator;

  /// @notice native price rounding factor
  /// @dev as the price of native asset can fluctuate from the moment of order request transaction transmission to block inclusion, the price is truncated
  uint256 public nativePriceRoundingDecimals;

  /// @notice Emitted when a new order is requested
  /// @param orderId The order id
  /// @param tokenId The token id
  /// @param customer The customer address
  /// @param orderType The type of order ( register , import or extension )
  /// @param numberOfYears The number of registration years requested
  /// @param tld The tld of the domain in clear text e.g. "com"
  /// @param orderData The armoured pgp encrypted order data. The data is encrypted with the custodian pgpPublicKey
  event OrderOpen(
    uint256 orderId,
    uint256 tokenId,
    address customer,
    uint256 orderType,
    uint256 numberOfYears,
    string tld,
    string orderData
  );

  /// @notice Emitted when an open order is acknowledged by the custodian
  /// @param orderId The order id
  event OrderInitiated(uint256 orderId);

  /// @notice Emitted when the acquisition of an initiated order has failed
  /// @param orderId The order id
  event OrderFail(uint256 orderId);

  /// @notice Emitted when the acquisition of an initiated order was successful
  event OrderSuccess(uint256 orderId);

  /// @notice Emitted when an order refund has failed
  /// @param tokenId The token id
  /// @param orderId The order id
  /// @param customer The customer address
  /// @param paymentToken The token address of the payment. will be address(0) for native asset
  /// @param paymentAmount The amount of the payment.
  event RefundFailed(
    uint256 tokenId,
    uint256 orderId,
    address customer,
    address paymentToken,
    uint256 paymentAmount
  );

  /// @notice Emitted when an order refund was successful
  /// @param tokenId The token id
  /// @param orderId The order id
  /// @param customer The customer address
  /// @param paymentToken The token address of the payment. will be address(0) for native asset
  /// @param paymentAmount The amount of the payment.
  event RefundSuccess(
    uint256 tokenId,
    uint256 orderId,
    address customer,
    address paymentToken,
    uint256 paymentAmount
  );

  /// @notice Checks if the caller is the custodian contract or one of its operators
  modifier onlyCustodian() {
    require(
      address(custodian) != address(0) &&
        (address(custodian) == msg.sender || custodian.isOperator(msg.sender)),
      "not custodian"
    );
    _;
  }

  function initialize(
    address _custodian,
    address _domainToken,
    address _chainlinkNativeAggregator,
    uint256 _nativePriceRoundingDecimals,
    uint256 _standardPriceDecimals
  ) public initializer {
    custodian = ICustodian(_custodian);
    domainToken = IDomain(_domainToken);
    nativeChainlinkAggregator = AggregatorV3Interface(_chainlinkNativeAggregator);
    nativePriceRoundingDecimals = _nativePriceRoundingDecimals;
    standardPriceDecimals = _standardPriceDecimals;
  }

  /// @notice Sets contract configurations.
  /// @dev Can only be called by owner of the contract
  /// @param _custodian The custodian contract address. Will not be set if address(0)
  /// @param _domainToken The domain token contract address. Will not be set if address(0)
  /// @param _aggregator The oracle address for native price in USD. Will not be set if address(0)
  /// @param _nativePriceRoundingDecimals The number of decimals for native price rounding.
  /// @param _standardPriceDecimals The number of decimals for standard price.
  function setConfigs(
    address _custodian,
    address _domainToken,
    address _aggregator,
    uint256 _nativePriceRoundingDecimals,
    uint256 _standardPriceDecimals
  ) external onlyOwner {
    if (_custodian != address(0)) {
      custodian = ICustodian(_custodian);
    }
    if (_domainToken != address(0)) {
      domainToken = IDomain(_domainToken);
    }
    if (_aggregator != address(0)) {
      nativeChainlinkAggregator = AggregatorV3Interface(_aggregator);
    }

    nativePriceRoundingDecimals = _nativePriceRoundingDecimals;
    standardPriceDecimals = _standardPriceDecimals;
  }

  /// @notice Adds a new stable token to the list of accepted stable tokens
  /// @dev Can only be called by custodian contract or one of its operators
  /// @param token The token address
  function addStableToken(address token) external onlyCustodian {
    if (!acceptedStableTokens.contains(token)) {
      acceptedStableTokens.set(token, block.timestamp);
    }
  }

  /// @notice Removes a stable token from the list of accepted stable tokens
  /// @dev Can only be called by custodian contract or one of its operators
  /// @param token The token address
  function removeStableToken(address token) external onlyCustodian {
    if (acceptedStableTokens.contains(token)) {
      acceptedStableTokens.remove(token);
    }
  }

  /// @notice Returns the list of accepted stable tokens
  /// @return The list of accepted stable tokens
  function getAcceptedStableTokens() external view returns (address[] memory) {
    uint256 length = acceptedStableTokens.length();
    address[] memory result = new address[](length);
    for (uint256 i = 0; i < length; i++) {
      (address token, ) = acceptedStableTokens.at(i);

      result[i] = token;
    }
    return result;
  }

  /// @notice Set standard prices for a list of tlds.
  /// @dev Can only be called by custodian contract or one of its operators
  /// @param _tlds The list of tlds
  /// @param prices The list of prices
  function setStandardPrice(string[] memory _tlds, uint256[] memory prices) external onlyCustodian {
    for (uint256 i = 0; i < _tlds.length; i++) {
      bytes32 tldKey = keccak256(abi.encode(_tlds[i]));
      standardPrices[tldKey] = prices[i];
    }
  }

  /// @notice Returns the standard price for a tld.
  /// @param _tld The tld
  function getStandardPrice(string memory _tld) public view returns (uint256) {
    bytes32 tldKey = keccak256(abi.encode(_tld));
    return standardPrices[tldKey] == 1 ? 0 : standardPrices[tldKey];
  }

  /// @notice Checks if a tld has a standard price.
  /// @param _tld The tld
  /// @return True if a standard price is set for the tld, false otherwise.
  function hasStandardPrice(string memory _tld) public view returns (bool) {
    bytes32 tldKey = keccak256(abi.encode(_tld));
    return standardPrices[tldKey] != 0;
  }

  /// @notice Returns the price of a tld in native asset.
  /// @param _tld The tld
  /// @return The price in native asset.
  function getNativePrice(string memory _tld) public view returns (uint256) {
    (, int256 iprice, , , ) = nativeChainlinkAggregator.latestRoundData();
    uint256 price = uint256(iprice);
    uint256 aggregatorDecimals = nativeChainlinkAggregator.decimals();
    if (price == 0) {
      revert("price not available");
    }

    uint256 standardPrice = getStandardPrice(_tld);
    if (standardPrice == 0) {
      return 0;
    }
    if (standardPriceDecimals < aggregatorDecimals) {
      standardPrice = standardPrice * 10**(aggregatorDecimals - standardPriceDecimals);
    }
    if (standardPriceDecimals > aggregatorDecimals) {
      standardPrice = standardPrice / 10**(standardPriceDecimals - aggregatorDecimals);
    }
    uint256 p = (standardPrice * 10**18) / price;

    return (p / 10**nativePriceRoundingDecimals) * (10**nativePriceRoundingDecimals);
  }

  /// @notice Returns the price of a tld in specified stable token
  /// @param _tld The tld
  /// @param token The stable token address
  /// @return The price in specified stable token.
  function getStablePrice(string memory _tld, address token) public view returns (uint256) {
    uint256 standardPrice = getStandardPrice(_tld);
    if (standardPrice == 0) {
      return 0;
    }
    uint256 stableTokenDecimals = IERC20Metadata(token).decimals();
    if (standardPriceDecimals < stableTokenDecimals) {
      standardPrice = standardPrice * 10**(stableTokenDecimals - standardPriceDecimals);
    }
    if (standardPriceDecimals > stableTokenDecimals) {
      standardPrice = standardPrice / 10**(standardPriceDecimals - stableTokenDecimals);
    }
    return standardPrice;
  }

  /// @notice Place an order. It can be called by any address.
  /// @dev The customer is the caller of the function.
  /// @dev Will fail if the tld is not accepted by custodian or if a standard price is not set for the tld.
  /// @dev Will also fail if desired payment token is not in the list of accepted stable tokens.
  /// @dev Will fail if payment can not be locked
  /// @dev For EXTEND orders, the tokenId must exist
  /// @dev will emit OrderOpen event on success
  /// @param info The order information.

  function request(DataStructs.OrderInfo memory info) external payable {
    require(hasStandardPrice(info.tld), "tld not accepted");
    uint256 requiredPaymentAmount;
    if (info.paymentToken == address(0)) {
      requiredPaymentAmount = getNativePrice(info.tld);
    } else {
      requiredPaymentAmount = getStablePrice(info.tld, info.paymentToken);
    }
    requiredPaymentAmount = requiredPaymentAmount * info.numberOfYears;
    checkAndAddOrder(info, msg.sender, requiredPaymentAmount, true);
  }

  function checkAndAddOrder(
    DataStructs.OrderInfo memory info,
    address customer,
    uint256 paymentAmount,
    bool withTokenCheck
  ) internal {
    require(
      info.isValidRequest(
        address(domainToken),
        address(custodian),
        acceptedStableTokens,
        withTokenCheck
      ),
      "invalid request"
    );

    require(info.hasPayment(paymentAmount), "payment not provided");
    releasePreviousOrder(info.tokenId);
    require(
      info.lockPayment(paymentAmount), //"payment not accepted"
      "004"
    );
    addOrder(info, customer, paymentAmount);
  }

  /// @notice Place an order signed by one of custodian operators. The payment amount provided with the order is not checked against the standard price set for the tld.
  /// @param info The order information.
  /// @param customer The customer address.
  /// @param paymentAmount The payment amount.
  /// @param validUntil The time until the order is valid.
  /// @param nonce The nonce of the order used for signature.
  /// @param signature The signature of the order provided by one of the custodian operators.
  function requestSigned(
    DataStructs.OrderInfo memory info,
    address customer,
    uint256 paymentAmount,
    uint256 validUntil,
    uint256 nonce,
    bytes memory signature
  ) external payable {
    require(
      custodian.checkSignature(
        info.encodeHash(customer, paymentAmount, validUntil, nonce),
        signature
      ),
      "invalid signature"
    );
    require(validUntil >= block.timestamp, "quote expired");
    checkAndAddOrder(info, customer, paymentAmount, false);
  }

  function addOrder(
    DataStructs.OrderInfo memory info,
    address customer,
    uint256 paymentAmount
  ) internal {
    _nextOrderId.increment();
    uint256 orderId = _nextOrderId.current();
    orders[orderId] = DataStructs.Order({
      id: orderId,
      customer: customer,
      orderType: info.orderType,
      status: DataStructs.OrderStatus.OPEN,
      tokenId: info.tokenId,
      numberOfYears: info.numberOfYears,
      paymentToken: info.paymentToken,
      paymentAmount: paymentAmount,
      openTime: block.timestamp,
      openWindow: block.timestamp + 7 days,
      settled: 0
    });
    userOrders[customer].push(orderId);
    book[info.tokenId] = orderId;
    emit OrderOpen(
      orderId,
      info.tokenId,
      customer,
      uint256(info.orderType),
      info.numberOfYears,
      info.tld,
      info.data
    );
  }

  /// @notice Get the total orders count.
  function ordersCount() external view returns (uint256) {
    return _nextOrderId.current();
  }

  function doRefund(DataStructs.Order storage order) internal {
    if (order.canRefund()) {
      if (!order.refund()) {
        emit RefundFailed(
          order.tokenId,
          order.id,
          order.customer,
          order.paymentToken,
          order.paymentAmount
        );
      } else {
        emit RefundSuccess(
          order.tokenId,
          order.id,
          order.customer,
          order.paymentToken,
          order.paymentAmount
        );
      }
    }
  }

  function releasePreviousOrder(uint256 tokenId) internal {
    uint256 orderId = book[tokenId];
    if (orderId > 0) {
      DataStructs.Order storage currentOrder = orders[orderId];
      if (!currentOrder.canRelease()) {
        revert("005"); //"active order exists"
      }
      doRefund(currentOrder);
    }
    delete book[tokenId];
  }

  /// @notice Customers can request a refund for a specific order that they made and was not initiated by the custodian and expired
  /// @dev can emit RefundSuccess / RefundFailed event
  /// @param orderId The order id.
  function requestRefund(uint256 orderId) external {
    require(
      orderId > 0, //"invalid order id"
      "006"
    );
    DataStructs.Order storage order = orders[orderId];
    require(
      order.canRefund(), //"not refundable"
      "007"
    );
    require(
      msg.sender == order.customer, //"only customer can request refund"
      "008"
    );
    doRefund(order);
    if (book[order.tokenId] == orderId) {
      delete book[order.tokenId];
    }
  }

  /// @notice Custodian acknowledges an order and begins the acquisition process.
  /// @param orderId The order id.
  function initiate(uint256 orderId) external onlyCustodian {
    DataStructs.Order storage order = orders[orderId];
    require(
      order.isOpen(), //"order already initiated"
      "009"
    );
    require(
      book[order.tokenId] == orderId, //"not the current active order for this token"
      "010"
    );
    order.status = DataStructs.OrderStatus.INITIATED;
    emit OrderInitiated(orderId);
  }

  /// @notice Custodian marks the order as successful when the acquisition process is complete.
  /// @dev will call domain token contract through custodian contract to mint or extend the domain.
  /// @dev will release the order locked funds to custodian.
  /// @param orderId The order id.
  /// @param successData The call data for the domain token contract.
  /// @param successDataSignature The signature of the call data.
  /// @param signatureNonceGroup The nonce group of the signature.
  /// @param signatureNonce The nonce of the signature.
  function success(
    uint256 orderId,
    bytes memory successData,
    bytes memory successDataSignature,
    bytes32 signatureNonceGroup,
    uint256 signatureNonce
  ) external onlyCustodian {
    DataStructs.Order storage order = orders[orderId];
    require(
      order.isInitiated(), //"order is not initiated"
      "011"
    );
    order.status = DataStructs.OrderStatus.SUCCESS;
    order.takePayment(owner());
    custodian.externalCallWithPermit(
      address(domainToken),
      successData,
      successDataSignature,
      signatureNonceGroup,
      signatureNonce
    );
    emit OrderSuccess(orderId);
    if (book[order.tokenId] == orderId) {
      delete book[order.tokenId];
    }
  }

  /// @notice Custodian marks the order as failed when the acquisition process has failed.
  /// @param orderId The order id.
  /// @param shouldRefund Whether the order should be refunded.
  function fail(uint256 orderId, bool shouldRefund) external onlyCustodian {
    DataStructs.Order storage order = orders[orderId];
    require(
      order.isInitiated(), //"order is not initiated"
      "012"
    );
    order.status = DataStructs.OrderStatus.FAILED;
    if (shouldRefund) {
      doRefund(order);
    } else {
      order.takePayment(owner());
    }
    if (book[order.tokenId] == orderId) {
      delete book[order.tokenId];
    }
    emit OrderFail(orderId);
  }
}
