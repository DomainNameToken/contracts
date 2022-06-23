// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DataStructs} from "./DataStructs.sol";

library Order {
  function isInitiated(DataStructs.Order storage order) internal view returns (bool) {
    return uint256(order.status) == uint256(DataStructs.OrderStatus.INITIATED);
  }

  function isOpen(DataStructs.Order storage order) internal view returns (bool) {
    return order.status == DataStructs.OrderStatus.OPEN;
  }

  function isExpired(DataStructs.Order storage order) internal view returns (bool) {
    return isOpen(order) && order.openTime + order.openWindow < block.timestamp;
  }

  function isRefunded(DataStructs.Order storage order) internal view returns (bool) {
    return order.status == DataStructs.OrderStatus.REFUNDED;
  }

  function isSuccessful(DataStructs.Order storage order) internal view returns (bool) {
    return order.status == DataStructs.OrderStatus.SUCCESS;
  }

  function isFailed(DataStructs.Order storage order) internal view returns (bool) {
    return order.status == DataStructs.OrderStatus.FAILED;
  }

  function canRefund(DataStructs.Order storage order) internal view returns (bool) {
    return
      !isRefunded(order) &&
      !isSuccessful(order) &&
      !isInitiated(order) &&
      (isFailed(order) || isOpen(order));
  }

  function canRelease(DataStructs.Order storage order) internal view returns (bool) {
    return !isInitiated(order) || isExpired(order);
  }

  function refund(DataStructs.Order storage order) internal returns (bool) {
    order.status = DataStructs.OrderStatus.REFUNDED;
    if (order.paymentToken == address(0)) {
      (bool success, ) = order.customer.call{value: order.paymentAmount}("");
      return success;
    } else {
      if (IERC20(order.paymentToken).balanceOf(address(this)) >= order.paymentAmount) {
        IERC20(order.paymentToken).transfer(order.customer, order.paymentAmount);
        return true;
      } else {
        return false;
      }
    }
  }
}
