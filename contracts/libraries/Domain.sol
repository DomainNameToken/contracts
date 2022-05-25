// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {DataStructs} from "./DataStructs.sol";

library Domain {
  function domainNameToId(string memory domainName) internal pure returns (uint256) {
    return uint256(keccak256(abi.encode(domainName)));
  }

  function domainHash(DataStructs.Domain storage domain) internal view returns (bytes32) {
    return keccak256(abi.encode(domain.name));
  }

  function getTokenId(DataStructs.Domain storage domain) internal view returns (uint256) {
    return uint256(keccak256(abi.encode(domain.name)));
  }

  function isNotLocked(DataStructs.Domain storage domain) internal view returns (bool) {
    return domain.locked == 0;
  }

  function isNotExpired(DataStructs.Domain storage domain) internal view returns (bool) {
    return domain.expiry > block.timestamp;
  }

  function isNotFrozen(DataStructs.Domain storage domain) internal view returns (bool) {
    return domain.frozen == 0;
  }

  function canTransfer(DataStructs.Domain storage domain) internal view returns (bool) {
    return isNotFrozen(domain) && isNotExpired(domain) && isNotLocked(domain);
  }

  function updateExpiry(DataStructs.Domain storage domain, uint256 expiry) internal {
    domain.expiry = expiry;
  }

  function setLock(DataStructs.Domain storage domain, bool status) internal {
    if (status) {
      domain.locked = block.timestamp;
    } else {
      domain.locked = 0;
    }
  }

  function setFreeze(DataStructs.Domain storage domain, bool status) internal {
    if (status) {
      domain.frozen = block.timestamp;
    } else {
      domain.frozen = 0;
    }
  }
}
