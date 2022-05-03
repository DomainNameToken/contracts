// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library DataStructs {
  struct Source {
    uint256 chainId;
    address owner;
    uint256 blockNumber;
  }

  struct Information {
    uint256 messageType;
    address custodian;
    uint256 tokenId;
    Source destination;
    Source source;
    uint256 nonce;
    string domainName;
    uint256 expiryTime;
    uint256 withdrawLocktime;
  }

  struct Domain {
    string name;
    uint256 expiryTime;
    uint256 lockTime;
    uint256 custodianLock;
    uint256 withdrawLocktime;
    uint256 withdrawInitiated;
  }
}
