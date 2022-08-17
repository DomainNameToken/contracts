// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {DataStructs} from "../libraries/DataStructs.sol";

/// @title IDomain
/// @notice Interface for the domain token
interface IDomain {
  /// @notice Emitted when a domain token is burned
  /// @param tokenId The token ID of the domain token that was burned
  /// @param expiry The expiry date of the domain token that was burned
  /// @param domainName The name of the domain token that was burned
  event DomainBurned(uint256 tokenId, uint256 expiry, string domainName);

  /// @notice Emitted when a domain token was minted
  /// @param tokenId The token ID of the domain token that was minted
  /// @param owner The owner of the domain token that was minted
  /// @param expiry The expiry date of the domain token that was minted
  /// @param domainName The name of the domain token that was minted
  event DomainMinted(uint256 tokenId, address owner, uint256 expiry, string domainName);

  /// @notice Emitted when a domain token was extended
  /// @param tokenId The token ID of the domain token that was extended
  /// @param owner The owner of the domain token that was extended
  /// @param expiry The expiry date of the domain token that was extended
  /// @param domainName the name of the domain token that was extended
  event DomainExtended(uint256 tokenId, address owner, uint256 expiry, string domainName);

  /// @notice Emitted when a domain token frozen status has changed
  /// @param tokenId The token ID of the domain token that was frozen
  /// @param status The new frozen status of the domain token
  event DomainFreeze(uint256 tokenId, uint256 status);

  /// @notice Emitted when a domain token lock status has changed
  /// @param tokenId The token ID of the domain token that was locked
  /// @param status The new lock status of the domain token
  event DomainLock(uint256 tokenId, uint256 status);

  /// @notice Emitted a withdraw request was made
  /// @param tokenId The token ID of the domain token that was locked
  /// @param owner The owner of the domain token
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

  function adminTransferFrom(address, uint256) external;

  function adminChangeMintTime(uint256, uint256) external;

  function canWithdraw(uint256) external view returns (bool);
}
