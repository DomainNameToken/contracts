// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import { CustodianLib } from "./libraries/Custodian.sol";
import { ICustodian } from "./interfaces/ICustodian.sol";
import { Destroyable } from "./Destroyable.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract CustodianImplementationV1 is ICustodian, Destroyable, Initializable {
    using CustodianLib for CustodianLib.Custodian;         
    CustodianLib.Custodian private custodian;
    
    constructor(){
        
    }

    function initialize(string memory _name, string memory _baseUrl) public initializer {
        custodian.setName(_name);
        custodian.setBaseUrl(_baseUrl);
    }
    
    function setCustodianInfo(string memory _name, string memory _baseUrl) external override onlyOwner {
        custodian.setName(_name);
        custodian.setBaseUrl(_baseUrl);
    }

    function getOwner() external override view returns(address) {
        return owner();
    }
    
    function name() external override view returns(string memory) {
        return custodian.name;
    }
    function baseUrl() external override view returns(string memory) {
        return custodian.baseUrl;
    }
    function addOperator(address operator) override external onlyOwner {
        custodian.addOperator(operator);
        emit OperatorAdded(operator);
    }
    function removeOperator(address operator) override external onlyOwner {
        custodian.removeOperator(operator);
        emit OperatorRemoved(operator);
    }
    function getOperators() override external view returns(address[] memory) {
        return custodian.getOperators();
    }
    function isOperator(address operator) override external view returns(bool) {
        return custodian.hasOperator(operator);
    }
    
    function checkSignature(bytes32 messageHash, bytes memory signature) override external view returns(bool) {
        return custodian.checkSignature(messageHash, signature);
    }

    modifier onlyOperator() {
        require(msg.sender == owner() 
                || custodian.hasOperator(msg.sender)
                );
        _;
    }

    function activateUser(address user) override external onlyOperator {
        require(custodian.isRegisteredUser(user), "Not Registered");
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
