// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {DataStructs} from "./DataStructs.sol";

/// @title Burn Information functions
/// @notice Provides functions for checking burn information
library BurnInformation {
  /// @notice constant value defining the burn message type
  /// @dev uint256 converted keccak256 hash of encoded "dnt.domain.messagetype.burn" string
  /// @return message type id
  function MESSAGE_TYPE() internal pure returns (uint256) {
    return uint256(keccak256(abi.encode("dnt.domain.messagetype.burn")));
  }

  /// @notice Encoded and hash information to be used for signature checking
  /// @param info The burn information
  /// @return keccak256 hash of the encoded information
  function encode(DataStructs.Information memory info) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encode(info.messageType, info.custodian, info.tokenId, info.domainName, info.expiry)
      );
  }

  /// @notice Checks if the burn information is valid
  /// @param info The burn information
  /// @return true if the information is valid, false otherwise
  function isValidInfo(DataStructs.Information memory info) internal view returns (bool) {
    return
      info.tokenId == uint256(keccak256(abi.encode(info.domainName))) &&
      info.expiry > block.timestamp &&
      info.messageType == MESSAGE_TYPE();
  }

  /// @notice Checks if the information contains the correct custodian address
  /// @param info The information
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
