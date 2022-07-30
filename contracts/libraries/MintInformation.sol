// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {DataStructs} from "./DataStructs.sol";

/// @title Mint Information functions
/// @notice Provides functions for checking mint information
library MintInformation {
  /// @notice constant value defining the mint message type
  /// @dev uint256 converted keccak256 hash of encoded "dnt.domain.messagetype.mint" string
  /// @return message type id
  function MESSAGE_TYPE() internal pure returns (uint256) {
    return uint256(keccak256(abi.encode("dnt.domain.messagetype.mint")));
  }

  /// @notice Encoded and hash information to be used for signature checking
  /// @param info The mint information
  /// @return keccak256 hash of the encoded information
  function encode(DataStructs.Information memory info) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encode(
          MESSAGE_TYPE(),
          info.custodian,
          info.owner,
          info.tokenId,
          info.domainName,
          info.expiry
        )
      );
  }

  /// @notice Check if the information is valid
  /// @dev Checks tokenId to be the correct one for domain name
  /// @dev Expiry timestamp must be in the future
  /// @dev owner can not be the zeroo address
  /// @dev messageType must be the Mint Message Type
  /// @param info The mint information
  /// @return true if the information is valid, false otherwise
  function isValidInfo(DataStructs.Information memory info) internal view returns (bool) {
    return
      info.tokenId == uint256(keccak256(abi.encode(info.domainName))) &&
      info.expiry > block.timestamp &&
      info.owner != address(0) &&
      info.messageType == MESSAGE_TYPE();
  }

  /// @notice Checks if the information contains the correct custodian address
  /// @param info The mint information
  /// @param expectedCustodian The custodian address
  /// @return true if the custodian is correct, false otherwise
  function isValidCustodian(DataStructs.Information memory info, address expectedCustodian)
    internal
    pure
    returns (bool)
  {
    return expectedCustodian == info.custodian;
  }
}
