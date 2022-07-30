// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {DataStructs} from "./DataStructs.sol";

/// @title Domain functionality
/// @notice Provides functions for checking and setting domain information
library Domain {
  /// @notice Compiles the tokenId of a given domainName
  /// @dev The tokenId is the keccak256 hash of the encoded domainName converted to uint256
  /// @param domainName The domain name to be compiled
  /// @return The tokenId of the domainName
  function domainNameToId(string memory domainName) internal pure returns (uint256) {
    return uint256(keccak256(abi.encode(domainName)));
  }

  /// @notice Get the keccak256 hash of the domain
  /// param domain The domain storage slot
  /// @return The keccak256 hash of the encoded domain name
  function domainHash(DataStructs.Domain storage domain) internal view returns (bytes32) {
    return keccak256(abi.encode(domain.name));
  }

  /// @notice Get the tokenId of a domain
  /// @dev The tokenId is the keccak256 hash of the encoded domainName converted to uint256
  /// @param domain The domain storage slot
  /// @return The tokenId of the domain
  function getTokenId(DataStructs.Domain storage domain) internal view returns (uint256) {
    return uint256(keccak256(abi.encode(domain.name)));
  }

  /// @notice Checks if the domain is not locked
  /// @param domain The domain storage slot
  /// @return True if the domain is not locked, false otherwise
  function isNotLocked(DataStructs.Domain storage domain) internal view returns (bool) {
    return domain.locked == 0;
  }

  /// @notice Checks if the domain is not expired
  /// @param domain The domain storage slot
  /// @return True if the domain is not expired, false otherwise
  function isNotExpired(DataStructs.Domain storage domain) internal view returns (bool) {
    return domain.expiry > block.timestamp;
  }

  /// @notice Checks if the domain is not frozen
  /// @param domain The domain storage slot
  /// @return True if the domain is not frozen, false otherwise
  function isNotFrozen(DataStructs.Domain storage domain) internal view returns (bool) {
    return domain.frozen == 0;
  }

  /// @notice Checks if the domain can be transferred
  /// @dev A domain token can be transferred to another owner if is not frozen, expired or locked
  /// @param domain The domain storage slot
  /// @return True if the domain can be transferred, false otherwise
  function canTransfer(DataStructs.Domain storage domain) internal view returns (bool) {
    return isNotFrozen(domain) && isNotExpired(domain) && isNotLocked(domain);
  }

  /// @notice Updates expiration date of a domain
  /// @param domain The domain storage slot
  /// @param expiry The new expiration date
  function updateExpiry(DataStructs.Domain storage domain, uint256 expiry) internal {
    domain.expiry = expiry;
  }

  /// @notice Set the lock status of a domain
  /// @param domain The domain storage slot
  /// @param status The new lock status. True for Locked, false for Unlocked
  function setLock(DataStructs.Domain storage domain, bool status) internal {
    if (status) {
      domain.locked = block.timestamp;
    } else {
      domain.locked = 0;
    }
  }

  /// @notice Set the freeze status of a domain
  /// @param domain The domain storage slot
  /// @param status The new freeze status. True for Frozen, false for Unfrozen
  function setFreeze(DataStructs.Domain storage domain, bool status) internal {
    if (status) {
      domain.frozen = block.timestamp;
    } else {
      domain.frozen = 0;
    }
  }
}
