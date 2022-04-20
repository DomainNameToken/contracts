// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICustodian {

    event UserRegistered(address indexed user);
    event UserActivated(address indexed user);
    event UserDeactivated(address indexed user);
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    
    function setCustodianInfo(string memory name, string memory baseUrl) external;
    function name() external view;
    function baseUrl() external view;
    function addOperator(address) external;
    function removeOperator(address) external;
    function getOperators() external returns(address[] memory);
    function isOperator(address) external view returns(bool);
    function checkSignature(bytes32, bytes memory) external view returns(bool);
    function activateUser(address) external;
    function deactivateUser(address) external;
    function isActiveUser(address) external view returns(bool);
    function registerUser(address) external;
}
