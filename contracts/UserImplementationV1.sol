// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IUser} from "./interfaces/IUser.sol";
import {Destroyable} from "./Destroyable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

contract UserImplementationV1 is IUser, Destroyable, Initializable {
  using EnumerableMap for EnumerableMap.UintToAddressMap;

  EnumerableMap.UintToAddressMap registeredUsers;
  EnumerableMap.UintToAddressMap activeUsers;

  uint256 public _usersDbStartTime;

  function initialize() public initializer {
    _usersDbStartTime = block.timestamp;
  }

  function registerUser(address user) public override onlyOwner {
    if (!registeredUsers.contains(uint256(uint160(user)))) {
      registeredUsers.set(uint256(uint160(user)), user);
      emit UserRegistered(user);
    }
  }

  function isRegisteredUser(address user) external view override returns (bool) {
    return registeredUsers.contains(uint256(uint160(user)));
  }

  function activateUser(address user) external override onlyOwner {
    registerUser(user);
    if (!activeUsers.contains(uint256(uint160(user)))) {
      activeUsers.set(uint256(uint160(user)), user);
      emit UserActivated(user);
    }
  }

  function deactivateUser(address user) public override onlyOwner {
    if (activeUsers.contains(uint256(uint160(user)))) {
      activeUsers.remove(uint256(uint160(user)));
      emit UserDeactivated(user);
    }
  }

  function isActiveUser(address user) external view override returns (bool) {
    return activeUsers.contains(uint256(uint160(user)));
  }

  function deregisterUser(address user) external override {
    deactivateUser(user);
    if (registeredUsers.contains(uint256(uint160(user)))) {
      registeredUsers.remove(uint256(uint160(user)));
      emit UserDeregistered(user);
    }
  }
}
