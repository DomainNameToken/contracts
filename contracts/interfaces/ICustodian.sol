// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICustodian {

    event UserRegistered(address indexed user);
    event UserActivated(address indexed user);
    event UserDeactivated(address indexed user);
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);

    function getOwner() external view returns(address);
    
    function setCustodianInfo(string memory, string memory) external;
    function name() external view returns(string memory);
    function baseUrl() external view returns(string memory);
    function addOperator(address) external;
    function removeOperator(address) external;
    function getOperators() external returns(address[] memory);
    function isOperator(address) external view returns(bool);
    function checkSignature(bytes32, bytes memory) external view returns(bool);
    function activateUser(address) external;
    function deactivateUser(address) external;
    function isActiveUser(address) external view returns(bool);
    function registerUser(address) external;
    function isRegisteredUser(address) external view returns(bool);
}
