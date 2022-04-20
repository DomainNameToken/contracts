// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { EnumerableMap } from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

library Custodian {
    using ECDSA for bytes32;
    using EnumerableMap for EnumerableMap.UintToAddressMap;
    struct Custodian {
        address identity;
        string name;
        string baseUrl;
        EnumerableMap.UintToAddressMap opperators;
    }
    function checkSignature(Custodian memory custodian, bytes32 messageHash, bytes memory signature) internal pure returns(bool){
        address signer = messageHash.toEthSignedMessageHash().recover(signature);
        return custodian.identity == signer
            || custodian.opperators
            .contains(uint256(uint160(address(signer))));
    }
    function hasOpperator(Custodian memory custodian, address opperator) internal view returns(bool){
        return custodian.opperators.contains(uint256(uint160(address(opperator))));
    }
    function addOpperator(Custodian storage custodian, address opperator) internal {
        custodian.opperators.set(uint256(uint160(address(opperator))), opperator);
    }
    function removeOpperator(Custodian storage custodian, address opperator) internal {
        custodian.opperators
            .remove(uint256(uint160(address(opperator))));
    }
    function getOpperators(Custodian memory custodian) internal view returns(address[] memory){
        uint256 numberOfOpperators = custodian.opperators.length();
        address[] memory addresses = new address[](numberOfOpperators);

        
        for(uint256 i = 0; i < numberOfOpperators; i++){
            addresses[i] = custodian.opperators.at(i);
        }
        return addresses;
    }
}
