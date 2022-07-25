// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICustodian {
  event OperatorAdded(address indexed operator);
  event OperatorRemoved(address indexed operator);

  function setCustodianInfo(string memory, string memory) external;

  function setPgpPublicKey(string memory) external;

  function name() external view returns (string memory);

  function baseUrl() external view returns (string memory);

  function addOperator(address) external;

  function removeOperator(address) external;

  function getOperators() external returns (address[] memory);

  function isOperator(address) external view returns (bool);

  function checkSignature(bytes32, bytes memory) external view returns (bool);

  function _nonce(bytes32) external view returns (uint256);

  function externalCall(address, bytes memory) external payable returns (bytes memory);

  function externalCallWithPermit(
    address _contract,
    bytes memory data,
    bytes memory signature,
    bytes32 signatureNonceGroup,
    uint256 signatureNonce
  ) external payable returns (bytes memory);

  function enableTlds(string[] memory) external;

  function disableTlds(string[] memory) external;

  function getTlds() external view returns (string[] memory);

  function isTldEnabled(string memory) external view returns (bool);

  function isTldEnabled(bytes32) external view returns (bool);
}
