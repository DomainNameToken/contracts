// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DataStructs} from "./DataStructs.sol";

library OrderInfo {
  function isValidRequest(DataStructs.OrderInfo memory info)
    internal
    view
    returns (bool)
  {
    return
      info.tokenContract != address(0) &&
      info.customer == msg.sender &&
      info.tokenId > 0 &&
      info.numberOfYears > 0 &&
      info.requestTime + info.openWindow > block.timestamp &&
      info.nonce > 0;
  }

  function encodeHash(DataStructs.OrderInfo memory info) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encode(
          info.tokenContract,
          info.customer,
          uint256(info.orderType),
          info.tokenId,
          info.numberOfYears,
          info.paymentToken,
          info.paymentAmount,
          info.paymentWindow,
          info.requestTime,
          info.openWindow,
          info.nonce
        )
      );
  }

  function inPaymentWindow(DataStructs.OrderInfo memory info) internal view returns (bool) {
    return info.requestTime + info.paymentWindow > block.timestamp;
  }

  function hasPayment(DataStructs.OrderInfo memory info) internal view returns (bool) {
    if (info.paymentToken == address(0)) {
      return msg.value >= info.paymentAmount;
    } else {
      return
        IERC20(info.paymentToken).balanceOf(msg.sender) >= info.paymentAmount &&
        IERC20(info.paymentToken).allowance(msg.sender, address(this)) >= info.paymentAmount;
    }
  }

  function lockPayment(DataStructs.OrderInfo memory info) internal returns (bool) {
    if (info.paymentToken == address(0)) {
      return true;
    } else {
      uint256 balanceBefore = IERC20(info.paymentToken).balanceOf(address(this));
      IERC20(info.paymentToken).transferFrom(msg.sender, address(this), info.paymentAmount);
      return
        IERC20(info.paymentToken).balanceOf(address(this)) >= (balanceBefore + info.paymentAmount);
    }
  }
}
