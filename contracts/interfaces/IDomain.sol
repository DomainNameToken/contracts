// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {DataStructs} from "../libraries/DataStructs.sol";

interface IDomain {
  event DomainBurned(uint256 tokenId, uint256 expiry, string domainName);
  event DomainMinted(uint256 tokenId, address owner, uint256 expiry, string domainName);
  event DomainExtended(uint256 tokenId, address owner, uint256 expiry, string domainName);

  event DomainFreeze(uint256 tokenId, uint256 status);
  event DomainLock(uint256 tokenId, uint256 status);
  event WithdrawRequest(uint256 tokenId, address owner);

  function exists(uint256 tokenId) external view returns (bool);

  function mint(DataStructs.Information memory) external returns (uint256);

  function extend(DataStructs.Information memory) external;

  function burn(DataStructs.Information memory) external;

  function getDomainInfo(uint256) external view returns (DataStructs.Domain memory);

  function setFreeze(uint256, bool) external;

  function setLock(uint256, bool) external;

  function setCustodian(address) external;

  function isLocked(uint256) external view returns (bool);

  function isFrozen(uint256) external view returns (bool);

  function withdraw(uint256) external;
}