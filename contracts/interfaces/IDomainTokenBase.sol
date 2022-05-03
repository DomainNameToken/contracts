// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {DataStructs} from "../libraries/DataStructs.sol";

interface IDomainTokenBase {
  event DomainBurned(
    uint256 chainId,
    uint256 tokenId,
    uint256 sourceChainId,
    uint256 destinationChainId,
    address sourceOwner,
    address destinationOwner,
    uint256 expiryTime,
    uint256 withdrawLocktime,
    string domainName
  );
  event DomainMinted(
    uint256 chainId,
    uint256 tokenId,
    uint256 sourceChainId,
    uint256 destinationChainId,
    address sourceOwner,
    address destinationOwner,
    uint256 expiryTime,
    uint256 withdrawLocktime,
    string domainName
  );
  event DomainExtended(
    uint256 chainId,
    uint256 tokenId,
    uint256 sourceChainId,
    uint256 destinationChainId,
    address sourceOwner,
    address destinationOwner,
    uint256 expiryTime,
    uint256 withdrawLocktime,
    string domainName
  );

  event CustodianLock(uint256 chainId, uint256 tokenId, uint256 timestamp);
  event WithdrawRequest(uint256 chainId, uint256 tokenId, address sender);
  event WithdrawFulfilled(uint256 chainId, uint256 tokenId, string domainName);
  event WithdrawCancel(uint256 chainId, uint256 tokenId);

  function getTokenIdByName(string memory) external view returns (uint256);

  function getDomainInfo(uint256) external view returns (DataStructs.Domain memory);

  function fulfillWithdraw(uint256) external;

  function cancelWithdrawRequest(uint256) external;

  function requestWithdraw(uint256) external;

  function setCustodianLock(uint256, bool) external;

  function setLock(uint256, bool) external;

  function setCustodian(address) external;
}
