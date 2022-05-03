// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { CustodianLib } from "./libraries/Custodian.sol";
import { ICustodian } from "./interfaces/ICustodian.sol";
import { Destroyable } from "./Destroyable.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import { EnumerableMap } from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

contract UserImplementationV1 is IUser, Destroyable, Initializable {
    using EnumerableMap for EnumerableMap.UintToAddressMap;
    
    function registerUser(Custodian storage custodian, address user) internal {
        custodian.registeredUsers.set(uint256(uint160(user)), user);
    }

    function isRegisteredUser(Custodian storage custodian, address user) internal view returns(bool){
        return custodian.registeredUsers.contains(uint256(uint160(user)));
    }
    
    function activateUser(Custodian storage custodian, address user) internal {
        custodian.activeUsers.set(uint256(uint160(user)), user);
        
    }
    function deactivateUser(Custodian storage custodian, address user) internal {
        custodian.activeUsers.remove(uint256(uint160(user)));
    }
    function isActiveUser(Custodian storage custodian, address user) internal view returns(bool){
        return custodian.activeUsers.contains(uint256(uint160(user)));
    }
    
    function activateUser(address user) override external onlyOwner {

        custodian.activateUser(user);
        emit UserActivated(user);
    }

    function deactivateUser(address user) override external onlyOperator {
        custodian.deactivateUser(user);
        emit UserDeactivated(user);
    }

    function isActiveUser(address user) override external view returns(bool) {
        return custodian.isActiveUser(user);
    }
    
    function registerUser(address user) override external onlyOperator {
        custodian.registerUser(user);
        emit UserRegistered(user);
    }

    function isRegisteredUser(address user) override external view returns(bool) {
        return custodian.isRegisteredUser(user);
    }

}
