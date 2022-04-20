// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { EnumerableMap } from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

library CustodianLib {
    using ECDSA for bytes32;
    using EnumerableMap for EnumerableMap.UintToAddressMap;
    struct Custodian {
        address identity;
        string name;
        string baseUrl;
        EnumerableMap.UintToAddressMap operators;
    }
    function checkSignature(Custodian memory custodian, bytes32 messageHash, bytes memory signature) internal pure returns(bool){
        address signer = messageHash.toEthSignedMessageHash().recover(signature);
        return custodian.identity == signer
            || custodian.operators
            .contains(uint256(uint160(address(signer))));
    }
    function hasOperator(Custodian memory custodian, address operator) internal view returns(bool){
        return custodian.operators.contains(uint256(uint160(address(operator))));
    }
    function addOperator(Custodian storage custodian, address operator) internal {
        custodian.operators.set(uint256(uint160(address(operator))), operator);
    }
    function removeOperator(Custodian storage custodian, address operator) internal {
        custodian.operators
            .remove(uint256(uint160(address(operator))));
    }
    function getOperators(Custodian memory custodian) internal view returns(address[] memory){
        uint256 numberOfOperators = custodian.operators.length();
        address[] memory addresses = new address[](numberOfOperators);

        
        for(uint256 i = 0; i < numberOfOperators; i++){
            addresses[i] = custodian.operators.at(i);
        }
        return addresses;
    }
}
