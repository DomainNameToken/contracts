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

contract AcquisitionManagerImplementationV2 is Destroyable, Initializable {
  using OrderInfo for DataStructs.OrderInfo;
  using Order for DataStructs.Order;
  using Counters for Counters.Counter;
  using EnumerableMap for EnumerableMap.AddressToUintMap;
  ICustodian public custodian;
  IDomain public domainToken;
  Counters.Counter private _nextOrderId;

  /*
    current order for a token
    tokenId to order id mapping
   */
  mapping(uint256 => uint256) public book;
  /*
    user order history
   */
  mapping(address => uint256[]) public userOrders;

  mapping(uint256 => DataStructs.Order) public orders;
  mapping(bytes32 => uint256) public standardPrices;
  uint256 public standardPriceDecimals;
  EnumerableMap.AddressToUintMap private acceptedStableTokens;
  AggregatorV3Interface public nativeChainlinkAggregator;
  uint256 public nativePriceRoundingDecimals;
  event OrderOpen(
    uint256 orderId,
    uint256 tokenId,
    address customer,
    uint256 orderType,
    uint256 numberOfYears,
    string tld,
    string orderData
  );
  event OrderInitiated(uint256 orderId);
  event OrderFail(uint256 orderId);
  event OrderSuccess(uint256 orderId);
  event RefundFailed(
    uint256 tokenId,
    uint256 orderId,
    address customer,
    address paymentToken,
    uint256 paymentAmount
  );
  event RefundSuccess(
    uint256 tokenId,
    uint256 orderId,
    address customer,
    address paymentToken,
    uint256 paymentAmount
  );
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

  function addStableToken(address token) external onlyCustodian {
    if (!acceptedStableTokens.contains(token)) {
      acceptedStableTokens.set(token, block.timestamp);
    }
  }

  function removeStableToken(address token) external onlyCustodian {
    if (acceptedStableTokens.contains(token)) {
      acceptedStableTokens.remove(token);
    }
  }

  function getAcceptedStableTokens() external view returns (address[] memory) {
    uint256 length = acceptedStableTokens.length();
    address[] memory result = new address[](length);
    for (uint256 i = 0; i < length; i++) {
      (address token, ) = acceptedStableTokens.at(i);

      result[i] = token;
    }
    return result;
  }

  function setStandardPrice(
    string[] memory _tlds,
    uint256[] memory prices
  ) external onlyCustodian {
    for (uint256 i = 0; i < _tlds.length; i++) {
      bytes32 tldKey = keccak256(abi.encode(_tlds[i]));
      standardPrices[tldKey] = prices[i];
    }

  }

  function getStandardPrice(string memory _tld) public view returns (uint256) {
    bytes32 tldKey = keccak256(abi.encode(_tld));
    return standardPrices[tldKey] == 1 ? 0 : standardPrices[tldKey];
  }

  function hasStandardPrice(string memory _tld) public view returns (bool) {
    bytes32 tldKey = keccak256(abi.encode(_tld));
    return standardPrices[tldKey] != 0;
  }

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
    /*
        round price to 4 decimals
       */
    return (p / 10**nativePriceRoundingDecimals) * (10**nativePriceRoundingDecimals);
  }

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
            info.isValidRequest(address(domainToken), address(custodian), acceptedStableTokens, withTokenCheck),
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
    order.takePayment(msg.sender);
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
      order.takePayment(msg.sender);
    }
    if (book[order.tokenId] == orderId) {
      delete book[order.tokenId];
    }
    emit OrderFail(orderId);
  }
}
