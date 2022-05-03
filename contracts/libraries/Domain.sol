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
    return domain.lockTime == 0;
  }

  function isNotExpired(DataStructs.Domain storage domain) internal view returns (bool) {
    return domain.expiryTime > block.timestamp;
  }

  function isNotCustodianLocked(DataStructs.Domain storage domain) internal view returns (bool) {
    return domain.custodianLock == 0;
  }

  function isNotWithdrawing(DataStructs.Domain storage domain) internal view returns (bool) {
    return domain.withdrawInitiated == 0;
  }

  function canInitiateWithdraw(DataStructs.Domain storage domain) internal view returns (bool) {
    return
      isNotWithdrawing(domain) &&
      isNotLocked(domain) &&
      isNotCustodianLocked(domain) &&
      domain.withdrawLocktime < block.timestamp;
  }

  function canTransfer(DataStructs.Domain storage domain) internal view returns (bool) {
    return
      isNotWithdrawing(domain) &&
      isNotCustodianLocked(domain) &&
      isNotExpired(domain) &&
      isNotLocked(domain);
  }

  function updateExpiry(DataStructs.Domain storage domain, uint256 expiryTime) internal {
    domain.expiryTime = expiryTime;
  }

  function setLock(DataStructs.Domain storage domain, bool status) internal {
    if (status) {
      domain.lockTime = block.timestamp;
    } else {
      domain.lockTime = 0;
    }
  }

  function setWithdraw(DataStructs.Domain storage domain, bool status) internal {
    if (status) {
      domain.withdrawInitiated = block.timestamp;
    } else {
      domain.withdrawInitiated = 0;
    }
  }

  function setCustodianLock(DataStructs.Domain storage domain, bool status) internal {
    if (status) {
      domain.custodianLock = block.timestamp;
    } else {
      domain.custodianLock = 0;
    }
  }
}
