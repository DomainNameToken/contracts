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
    using Counters for Counters.Counters;
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
  mapping(address=>uint256[]) public userOrders;

  mapping(uint256=>DataStructs.Order) public orders;
  
  event OrderOpen();
  event OrderCancel();
  event OrderFail();
  event OrderSuccess();
  event RefundFailed(uint256 tokenId, uint256 orderId, address customer, address paymentToken, uint256 paymentAmount);
  event RefundSuccess(uint256 tokenId, uint256 orderId, address customer, address paymentToken, uint256 paymentAmount);
  modifier onlyCustodian() {
      require(address(custodian) != address(0)
              && (address(custodian) == msg.sender
                  || custodian.isOperator(msg.sender)), "not custodian");
  }
  
  function initialize(address _custodian) public initializer {
    custodian = ICustodian(_custodian);
  }
  
  function request(OrderInfo memory info, bytes memory signature) external payable {
    require(info.isValidRequest(custodian.chainId()), "request not valid");
    require(custodian.checkSignature(info.encodeHash(), signature), "invalid signature");
    require(info.hasPayment(), "payment not provided");
    
    releasePreviousInactiveOrder(info.tokenId);

    require(info.takePayment(), "payment not accepted");

    require(canAddOrder(info), "invalid state");
    //appendOrder(info);
  }

  function releasePreviousOrder(uint256 tokenId) internal {
      uint256 orderId = book[tokenId];
      if (orderId > 0) {
          DataStructs.Order storage currentOrder = orders[orderId];
          
          if (currentOrder.shouldRefund()) {
              if(!currentOrder.refund()){
                  emit RefundFailed(tokenId, orderId, currentOrder.customer, currentOrder.paymentToken, currentOrder.paymentAmount);
              } else {
                  emit RefundSuccess(tokenId, orderId, currentOrder.customer, currentOrder.paymentToken, currentOrder.paymentAmount);
              }
          } else {
              if(currentOrder.isInitiated()){
                  revert("active order exists");
              }
          }
      }
      delete book[tokenId];
  }
  

  function initiate(uint256 tokenId) onlyCustodian {
      uint256 orderId = book[tokenId];
      if(orderId > 0){
          revert("an active order exists for this token");
      }
  }

  function cancel() external {}

  function success() external onlyCustodian {}

  function fail() external onlyCustodian {}
}
