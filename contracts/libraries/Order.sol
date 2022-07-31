// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DataStructs} from "./DataStructs.sol";

/// @title Order functions
/// @notice Provides function for checking and managing an order
library Order {
  /// @notice Checks if the order was initiated ( acknowledged by the custodian )
  /// @param order The order
  /// @return True if the order was initiated, false otherwise
  function isInitiated(DataStructs.Order storage order) internal view returns (bool) {
      return order.status == DataStructs.OrderStatus.INITIATED;
  }

  /// @notice Check if the order status is open and not acknowledged by the custodian
  function isOpen(DataStructs.Order storage order) internal view returns (bool) {
    return order.status == DataStructs.OrderStatus.OPEN;
  }

  /// @notice Check if the order is open and is not acknowledged by the custodian in openWindow timeframe
  /// @param order The order
  /// @return True if the order is open and is not acknowledged by the custodian in openWindow timeframe, false otherwise
  function isExpired(DataStructs.Order storage order) internal view returns (bool) {
    return isOpen(order) && order.openTime + order.openWindow < block.timestamp;
  }

  /// @notice Checks if the order status is refunded
  /// @param order The order
  /// @return True if the order status is refunded, false otherwise
  function isRefunded(DataStructs.Order storage order) internal view returns (bool) {
    return order.status == DataStructs.OrderStatus.REFUNDED;
  }

  /// @notice Checks if the order status is success
  /// @param order The order
  /// @return True if the order status is success, false otherwise
  function isSuccessful(DataStructs.Order storage order) internal view returns (bool) {
    return order.status == DataStructs.OrderStatus.SUCCESS;
  }

  /// @notice Checks if the order status is failed
  /// @param order The order
  /// @return True if the order status is failed, false otherwise
  function isFailed(DataStructs.Order storage order) internal view returns (bool) {
    return order.status == DataStructs.OrderStatus.FAILED;
  }

  /// @notice Checks if the order can be refunded
  /// @dev An order can be refunded if it wasn't previosly marked as refunded, is not successful, is not initiated and is either failed or open
  /// @param order The order
  /// @return True if the order can be refunded, false otherwise
  function canRefund(DataStructs.Order storage order) internal view returns (bool) {
    return
      !isRefunded(order) &&
      !isSuccessful(order) &&
      !isInitiated(order) &&
      (isFailed(order) || isOpen(order));
  }

  /// @notice Checks if the order can be released from active order of a token
  /// @param order The order
  /// @return True if the order can be released from active order of a token, false otherwise
  function canRelease(DataStructs.Order storage order) internal view returns (bool) {
      return isExpired(order);
  }

  /// @notice Refund the amount of the order
  /// @param order The order
  /// @return True if the order was successfully refunded, false otherwise
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

  /// @notice Release the payment amount of the order
  /// @param order The order
  /// @param fundsDestination The destination of the funds
  /// @return True if the order payment amount was successfully released, false otherwise
  function takePayment(DataStructs.Order storage order, address fundsDestination)
    internal
    returns (bool)
  {
    if (order.settled > 0) {
      return false;
    }
    if (order.paymentToken == address(0)) {
      if (address(this).balance >= order.paymentAmount) {
        order.settled = block.timestamp;
        (bool success, ) = fundsDestination.call{value: order.paymentAmount}("");
        return success;
      } else {
        return false;
      }
    } else {
      if (IERC20(order.paymentToken).balanceOf(address(this)) >= order.paymentAmount) {
        order.settled = block.timestamp;
        IERC20(order.paymentToken).transfer(fundsDestination, order.paymentAmount);
        return true;
      } else {
        return false;
      }
    }
  }
}
