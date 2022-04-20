// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import { CustodianLib } from "./libraries/Custodian.sol";

contract Custodian is ICustodian, Destroyable {
    using CustodianLib for CustodianLib.Custodian;         
    CustodianLib.Custodian public custodian;
    constructor(){
        
    }
    
    function setCustodian(string memory name, baseUrl) external onlyOwner {
        custodian = CustodianLib.Custodian({
            name: name,
                    baseUrl: baseUrl
                    });
    }
    function addOperator(address operator) external onlyOwner {
        custodian.addOperator(operator);
    }
    function removeOperator(address operator) external onlyOwner {
        custodian.removeOperator(operator);
    }
    function getOperators() external view returns(address[] memory) {
        return custodian.getOperators();
    }
    function isOperator(address operator) external view returns(bool) {
        return custodian.hasOperator(operator);
    }
    
    function checkSignature(bytes32 messageHash, bytes memory signature) external view returns(bool) {
        return custodian.checkSignature(messageHash, signature);
    }

    modifier onlyOperator() {
        require(msg.sender == owner() 
                || custodian.hasOperator(msg.sender)
                );
        _;
    }

    function activateUser(address user) external onlyOperator {

    }

    function deactivateUser(address user) external onlyOperator {

    }

    function isActiveUser(address user) external view returns(bool) {
        
    }
    
    function registerUser(address user) external onlyOperator {
        
    }
    
}
