// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IUser {
 event UserRegistered(address indexed user);
 event UserActivated(address indexed user);
 event UserDeactivated(address indexed user);
 event UserDeregistered(address indexed user);

 function activateUser(address) external;

 function deactivateUser(address) external;

 function isActiveUser(address) external view returns (bool);

 function registerUser(address) external;

 function isRegisteredUser(address) external view returns (bool);

 function deregisterUser(address) external;
}
