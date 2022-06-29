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
    Source source;
    Source destination;
    string domainName;
    uint256 expiry;
  }

  struct Domain {
    string name;
    uint256 expiry;
    uint256 locked;
    uint256 frozen;
  }

  enum OrderType {
    REGISTER,
    TRANSFER,
    EXTEND
  }
  enum OrderStatus {
    OPEN,
    INITIATED,
    SUCCESS,
    FAILED,
    REFUNDED
  }

  struct OrderInfo {
    address tokenContract;
    address customer;
    uint256 chainId;
    OrderType orderType;
    uint256 tokenId;
    uint256 numberOfYears;
    address paymentToken;
    uint256 paymentAmount;
    uint256 paymentWindow;
    uint256 requestTime;
    uint256 openWindow;
    uint256 nonce;
  }

  struct Order {
    uint256 id;
    address tokenContract;
    address customer;
    OrderType orderType;
    OrderStatus status;
    uint256 tokenId;
    uint256 numberOfYears;
    address paymentToken;
    uint256 paymentAmount;
    uint256 openTime;
    uint256 openWindow;
    uint256 settled;
  }
}
