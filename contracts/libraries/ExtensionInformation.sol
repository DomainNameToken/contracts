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
    abi.encode(
     MESSAGE_TYPE(),
     info.custodian,
     info.tokenId,
     info.destination.chainId,
     info.destination.owner,
     info.destination.blockNumber,
     info.source.chainId,
     info.source.owner,
     info.source.blockNumber,
     info.nonce,
     info.domainName,
     info.expiryTime,
     info.withdrawLocktime
    )
   );
 }

 function isValidInfo(DataStructs.Information memory info) internal view returns (bool) {
  return
   info.tokenId == uint256(keccak256(abi.encode(info.domainName))) &&
   info.expiryTime > block.timestamp &&
   info.source.owner != address(0) &&
   info.source.owner == info.destination.owner &&
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
  return block.number >= info.source.blockNumber && block.number >= info.destination.blockNumber;
 }
}
