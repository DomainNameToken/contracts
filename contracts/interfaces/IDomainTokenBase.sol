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
    uint256 expiry,
    string domainName
  );
  event DomainMinted(
    uint256 chainId,
    uint256 tokenId,
    uint256 sourceChainId,
    uint256 destinationChainId,
    address sourceOwner,
    address destinationOwner,
    uint256 expiry,
    string domainName
  );
  event DomainExtended(
    uint256 chainId,
    uint256 tokenId,
    uint256 sourceChainId,
    uint256 destinationChainId,
    address sourceOwner,
    address destinationOwner,
    uint256 expiry,
    string domainName
  );

  event DomainFreeze(uint256 chainId, uint256 tokenId, uint256 status);
  event DomainLock(uint256 chainId, uint256 tokenId, uint256 status);

  function getTokenIdByName(string memory) external view returns (uint256);

  function getDomainInfo(uint256) external view returns (DataStructs.Domain memory);

  function setFreeze(uint256, bool) external;

  function setLock(uint256, bool) external;

  function setCustodian(address) external;
}
