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
    string domainName;
    uint256 expiry;
  }

  struct Domain {
    string name;
    uint256 expiry;
    uint256 locked;
    uint256 frozen;
  }
}
