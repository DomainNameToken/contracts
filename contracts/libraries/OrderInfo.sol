// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import {DataStructs} from "./DataStructs.sol";
import {IDomain} from "../interfaces/IDomain.sol";
import {ICustodian} from "../interfaces/ICustodian.sol";

library OrderInfo {
  using EnumerableMap for EnumerableMap.AddressToUintMap;

  function isValidRequest(
    DataStructs.OrderInfo memory info,
    address domainToken,
    address custodian,
    EnumerableMap.AddressToUintMap storage acceptedStableTokens,
    bool withTokenCheck
  ) internal view returns (bool) {
    if (info.tokenId == 0) {
      return false;
    }
    if (
      info.orderType != DataStructs.OrderType.REGISTER &&
      info.orderType != DataStructs.OrderType.IMPORT &&
      info.orderType != DataStructs.OrderType.EXTEND
    ) {
      return false;
    }
    if (info.orderType == DataStructs.OrderType.REGISTER) {
      if (IDomain(domainToken).exists(info.tokenId)) {
        return false;
      }
      if (info.numberOfYears == 0) {
        return false;
      }
    }
    if (info.orderType == DataStructs.OrderType.IMPORT) {
      if (IDomain(domainToken).exists(info.tokenId)) {
        return false;
      }
      if (info.numberOfYears != 1) {
        return false;
      }
    }
    if (info.orderType == DataStructs.OrderType.EXTEND) {
      if (!IDomain(domainToken).exists(info.tokenId)) {
        return false;
      }
      if (info.numberOfYears == 0) {
        return false;
      }
    }
    if(withTokenCheck){
        if (info.paymentToken != address(0)) {
            if (!acceptedStableTokens.contains(info.paymentToken)) {
                return false;
            }
        }
    }
    if (!ICustodian(custodian).isTldEnabled(info.tld)) {
      return false;
    }
    if (bytes(info.data).length == 0) {
      return false;
    }
    return true;
  }

  function encodeHash(
    DataStructs.OrderInfo memory info,
    address customer,
    uint256 paymentAmount,
    uint256 validUntil,
    uint256 nonce
  ) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encode(
          uint256(info.orderType),
          info.tokenId,
          info.numberOfYears,
          info.paymentToken,
          info.tld,
          info.data,
          customer,
          paymentAmount,
          validUntil,
          nonce
        )
      );
  }

  function hasPayment(DataStructs.OrderInfo memory info, uint256 requiredAmount)
    internal
    view
    returns (bool)
  {
    if (info.paymentToken == address(0)) {
      return msg.value >= requiredAmount;
    } else {
      return
        IERC20(info.paymentToken).balanceOf(msg.sender) >= requiredAmount &&
        IERC20(info.paymentToken).allowance(msg.sender, address(this)) >= requiredAmount;
    }
  }

  function lockPayment(DataStructs.OrderInfo memory info, uint256 requiredAmount)
    internal
    returns (bool)
  {
    if (requiredAmount == 0) {
      return true;
    }
    if (info.paymentToken == address(0)) {
      return true;
    } else {
      uint256 balanceBefore = IERC20(info.paymentToken).balanceOf(address(this));
      IERC20(info.paymentToken).transferFrom(msg.sender, address(this), requiredAmount);
      return IERC20(info.paymentToken).balanceOf(address(this)) >= (balanceBefore + requiredAmount);
    }
  }
}
