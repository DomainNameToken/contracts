// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library DataStructs {
  /// @notice Information required for minting, extending or burning a domain token.
  struct Information {
    // Each type of domain action minting,extending and burning is assigned an unique indetifier which is defined in the library that handles functionality for the specific action.
    uint256 messageType;
    // the custodian contract address
    address custodian;
    // the tokenId
    uint256 tokenId;
    // owner of the token
    address owner;
    // domain name of the token
    string domainName;
    // expiry timestamp of the token
    uint256 expiry;
  }

  /// @notice Domain information attached to a token
  struct Domain {
    // The domain name of the token
    string name;
    // the expiry timestamp of the token
    uint256 expiry;
    // timestamp of when the token was locked. Will be 0 if not locked.
    uint256 locked;
    // timestamp of when the token was frozen. A token can be frozen by custodian in case of emergency or disputes. Will be 0 if not frozen.
    uint256 frozen;
  }

  /// @notice Type of acquisition manager orders
  enum OrderType {
    UNDEFINED, // not used
    REGISTER, // register a new domain
    IMPORT, // import a domain from another registrar
    EXTEND // extend the expiration date of a domain token
  }
  enum OrderStatus {
    UNDEFINED, // not used
    OPEN, // order has been placed by customer
    INITIATED, // order has been acknowledged by custodian
    SUCCESS, // order has been completed successfully
    FAILED, // order has failed
    REFUNDED // order has been refunded
  }

  /// @notice Order information when initiating an order with acquisition manager
  struct OrderInfo {
    OrderType orderType;
    // The domain token id
    uint256 tokenId;
    // number of registration years
    uint256 numberOfYears;
    // desired payment token. address(0) for native asset payments.
    address paymentToken;
    // tld of the domain in clear text
    string tld;
    // pgp encrypted order data with custodian pgp public key.
    // It is important for the data to be encrypted and not in plain text for security purposes.
    // The message that is encrypted is in json format and contains the order information e.g. { "domainName": "example.com", "transferCode": "authC0d3" }. More information on custodian website.
    string data;
  }

  /// @notice Order information stored in acquisition manager
  struct Order {
    // The order id
    uint256 id;
    // The customer who requested the order
    address customer;
    // Type of order
    OrderType orderType;
    // Status of order
    OrderStatus status;
    // The domain token id
    uint256 tokenId;
    // number of registration years
    uint256 numberOfYears;
    // payment token address
    address paymentToken;
    // payment amount
    uint256 paymentAmount;
    // Open timestamp of the order
    uint256 openTime;
    // Open window before order is considered expired
    uint256 openWindow;
    // when was the order settled
    uint256 settled;
  }
}
