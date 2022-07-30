// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {DataStructs} from "./DataStructs.sol";

/// @title Mint Information functions
/// @notice Provides functions for checking token expiration extension information
library ExtensionInformation {
  /// @notice constant value defining the extension message type
  /// @dev uint256 converted keccak256 hash of encoded "dnt.domain.messagetype.extension" string
  /// @return message type id
  function MESSAGE_TYPE() internal pure returns (uint256) {
    return uint256(keccak256(abi.encode("dnt.domain.messagetype.extension")));
  }

  /// @notice Encoded and hash information to be used for signature checking
  /// @param info The extension information
  /// @return keccak256 hash of the encoded information
  function encode(DataStructs.Information memory info) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encode(MESSAGE_TYPE(), info.custodian, info.tokenId, info.domainName, info.expiry)
      );
  }

  /// @notice Checks if the extension information is valid
  /// @dev Token id must be the correct one for domain name
  /// @dev Expiry timestamp must be in the future
  /// @dev messageType must be the ExtensionInformation message type
  /// @param info The extension information
  /// @return true if the information is valid, false otherwise
  function isValidInfo(DataStructs.Information memory info) internal view returns (bool) {
    return
      info.tokenId == uint256(keccak256(abi.encode(info.domainName))) &&
      info.expiry > block.timestamp &&
      info.messageType == MESSAGE_TYPE();
  }

  /// @notice Checks if the information contains the correct custodian address
  /// @param info The extension information
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
