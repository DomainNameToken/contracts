/// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {Destroyable} from "./Destroyable.sol";
import {ICustodian} from "./interfaces/ICustodian.sol";
import {DataStructs} from "./libraries/DataStructs.sol";
import {OrderInfo} from "./libraries/OrderInfo.sol";
import {Order} from "./libraries/Order.sol";

contract AcquisitionManager is Destroyable, Initializable {
  using OrderInfo for DataStructs.OrderInfo;
  using Order for DataStructs.Order;
  using Counters for Counters.Counter;
  ICustodian public custodian;
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

  event OrderOpen(
    uint256 orderId,
    uint256 tokenId,
    address customer,
    uint256 orderType,
    uint256 numberOfYears
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

  function initialize(address _custodian) public initializer {
    custodian = ICustodian(_custodian);
  }

  function setCustodian(address _custodian) external onlyOwner {
    custodian = ICustodian(_custodian);
  }

  function request(DataStructs.OrderInfo memory info, bytes memory signature) external payable {
    require(
      info.isValidRequest(custodian.chainId()), //"request not valid"
      "001"
    );
    require(
      custodian.checkSignature(info.encodeHash(), signature), //"invalid signature"
      "002"
    );
    require(
      info.hasPayment(), //"payment not provided"
      "003"
    );

    releasePreviousOrder(info.tokenId);

    require(
      info.lockPayment(), //"payment not accepted"
      "004"
    );
    //    require(canAddOrder(info), "invalid state");
    addOrder(info);
  }

  function addOrder(DataStructs.OrderInfo memory info) internal {
    _nextOrderId.increment();
    uint256 orderId = _nextOrderId.current();
    orders[orderId] = DataStructs.Order({
      id: orderId,
      tokenContract: info.tokenContract,
      customer: info.customer, // a valid OrderInfo would have customer == msg.sender
      orderType: info.orderType,
      status: DataStructs.OrderStatus.OPEN,
      tokenId: info.tokenId,
      numberOfYears: info.numberOfYears,
      paymentToken: info.paymentToken,
      paymentAmount: info.paymentAmount,
      openTime: block.timestamp,
      openWindow: info.openWindow,
      settled: 0
    });
    userOrders[info.customer].push(orderId);
    book[info.tokenId] = orderId;
    emit OrderOpen(
      orderId,
      info.tokenId,
      info.customer,
      uint256(info.orderType),
      info.numberOfYears
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
      order.tokenContract,
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
