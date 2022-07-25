// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {DataStructs} from "./DataStructs.sol";

library ExtensionInformation {
  function MESSAGE_TYPE() internal pure returns (uint256) {
    return uint256(keccak256(abi.encode("dnt.domain.messagetype.extension")));
  }

  function encode(DataStructs.Information memory info) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encode(MESSAGE_TYPE(), info.custodian, info.tokenId, info.domainName, info.expiry)
      );
  }

  function isValidInfo(DataStructs.Information memory info) internal view returns (bool) {
    return
      info.tokenId == uint256(keccak256(abi.encode(info.domainName))) &&
      info.expiry > block.timestamp &&
      info.messageType == MESSAGE_TYPE();
  }

  function isValidCustodian(DataStructs.Information memory info, address expectedCustodian)
    internal
    pure
    returns (bool)
  {
    return expectedCustodian == info.custodian;
  }
}
