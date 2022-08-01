// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import {DataStructs} from "./DataStructs.sol";
import {IDomain} from "../interfaces/IDomain.sol";
import {ICustodian} from "../interfaces/ICustodian.sol";

/// @title Functions for checking order information
/// @notice Provides function for checking order information
library OrderInfo {
  using EnumerableMap for EnumerableMap.AddressToUintMap;

  /// @notice Checks if the order information is valid
  /// @param info Order information
  /// @param domainToken Address of domain token contract
  /// @param custodian Address of custodian contract
  /// @param acceptedStableTokens List of all accepted stable tokens
  /// @param withTokenCheck When true, checks if info.paymentToken is in acceptedStableTokens
  /// @return True if the order information is valid, false otherwise
  function isValidRequest(
    DataStructs.OrderInfo memory info,
    address domainToken,
    address custodian,
    EnumerableMap.AddressToUintMap storage acceptedStableTokens,
    bool withTokenCheck
  ) internal view returns (bool) {
    // can not accept an order for a non set token id
    if (info.tokenId == 0) {
      return false;
    }
    // The type of the order should be one of REGISTER / IMPORT / EXTEND
    if (
      info.orderType != DataStructs.OrderType.REGISTER &&
      info.orderType != DataStructs.OrderType.IMPORT &&
      info.orderType != DataStructs.OrderType.EXTEND
    ) {
      return false;
    }
    // When the order type is REGISTER check if the token was not previously minted
    // Minimum numberOfYears should not be zero
    if (info.orderType == DataStructs.OrderType.REGISTER) {
      if (IDomain(domainToken).exists(info.tokenId)) {
        return false;
      }
      if (info.numberOfYears == 0) {
        return false;
      }
    }
    // When the order type is IMPORT check if the token was not previously minted
    // The number of years has to be 1
    if (info.orderType == DataStructs.OrderType.IMPORT) {
      if (IDomain(domainToken).exists(info.tokenId)) {
        return false;
      }
      if (info.numberOfYears != 1) {
        return false;
      }
    }

    // When the order type is EXTEND check if the token was previously minted
    // The number of years must not be zero
    if (info.orderType == DataStructs.OrderType.EXTEND) {
      if (!IDomain(domainToken).exists(info.tokenId)) {
        return false;
      }
      if (info.numberOfYears == 0) {
        return false;
      }
    }
    // If requested, check if the paymentToken is in acceptedStableTokens
    if (withTokenCheck) {
      if (info.paymentToken != address(0)) {
        if (!acceptedStableTokens.contains(info.paymentToken)) {
          return false;
        }
      }
    }

    // Check if the provided tld is enabled with custodian
    if (!ICustodian(custodian).isTldEnabled(info.tld)) {
      return false;
    }

    // order data should not be empty
    if (bytes(info.data).length == 0) {
      return false;
    }
    return true;
  }

  /// @notice Encode and hash the order information
  /// @param info Order information
  /// @param customer The customer address
  /// @param paymentAmount The payment amount
  /// @param validUntil The valid until timestamp
  /// @param nonce The nonce
  /// @return The keccak256 hash of the abi encoded order information
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

  /// @notice Check if payment for order info is provided
  /// @dev When paymentToken is set to address(0) check if msg.value is greater than requiredAmount
  /// @dev When paymentToken is not address(0) check if balance of msg.sender is greater than requiredAmount and the allowance of acquisitionManager contract address is greater than requiredAmount
  /// @param info Order information
  /// @param requiredAmount The required payment amount
  /// @return True if the payment amount is provided, false otherwise
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

  /// @notice Lock the payment amount for the order info
  /// @dev When paymentToken is not address(0) transfer from msg.sender to acquisitionManager contract address the requiredAmount
  /// @param info Order information
  /// @param requiredAmount The required payment amount
  /// @return True if the payment amount was successfully locked, false otherwise
  function lockPayment(DataStructs.OrderInfo memory info, uint256 requiredAmount)
    internal
    returns (bool)
  {
    if (requiredAmount == 0) {
      return true;
    }
    if (info.paymentToken == address(0)) {
        // send back any surplus amount
        if(requiredAmount < msg.value){
            payable(msg.sender).transfer(msg.value - requiredAmount);
        }
        return true;
    } else {
      uint256 balanceBefore = IERC20(info.paymentToken).balanceOf(address(this));
      IERC20(info.paymentToken).transferFrom(msg.sender, address(this), requiredAmount);
      return IERC20(info.paymentToken).balanceOf(address(this)) >= (balanceBefore + requiredAmount);
    }
  }
}
