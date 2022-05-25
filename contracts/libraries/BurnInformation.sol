// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {DataStructs} from "./DataStructs.sol";

library BurnInformation {
  function MESSAGE_TYPE() internal pure returns (uint256) {
    return uint256(keccak256(abi.encode("dnt.domain.messagetype.burn")));
  }

  function encode(DataStructs.Information memory info) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encode(
          info.messageType,
          info.custodian,
          info.tokenId,
          info.destination.chainId,
          info.destination.owner,
          info.destination.blockNumber,
          info.source.chainId,
          info.source.owner,
          info.source.blockNumber,
          info.domainName,
          info.expiry
        )
      );
  }

  function isValidInfo(DataStructs.Information memory info) internal view returns (bool) {
    return
      info.tokenId == uint256(keccak256(abi.encode(info.domainName))) &&
      info.expiry > block.timestamp &&
      info.source.owner != address(0) &&
      info.messageType == MESSAGE_TYPE();
  }

  function isValidChainId(DataStructs.Information memory info, uint256 expectedChainId)
    internal
    pure
    returns (bool)
  {
    return expectedChainId == info.source.chainId;
  }

  function isValidCustodian(DataStructs.Information memory info, address expectedCustodian)
    internal
    pure
    returns (bool)
  {
    return expectedCustodian == info.custodian;
  }

  function isValidBlock(DataStructs.Information memory info) internal view returns (bool) {
    return block.number >= info.source.blockNumber;
  }
}
