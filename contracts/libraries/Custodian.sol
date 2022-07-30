// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

/// @title Custodian functions
/// @notice Provides functions for managing custodians
library CustodianLib {
  using ECDSA for bytes32;
  using EnumerableMap for EnumerableMap.UintToAddressMap;

  struct Custodian {
    /// @dev The name of the custodian
    string name;
    /// @dev Base url of the custodian
    string baseUrl;
    /// @dev The list of operators of the custodian
    EnumerableMap.UintToAddressMap operators;
  }

  /// @notice Sets the name of the custodian
  /// @param custodian The custodian storage slot
  /// @param name The name of the custodian
  function setName(Custodian storage custodian, string memory name) internal {
    custodian.name = name;
  }

  /// @notice Sets the base url of the custodian
  /// @param custodian The custodian storage slot
  /// @param baseUrl The base url of the custodian
  function setBaseUrl(Custodian storage custodian, string memory baseUrl) internal {
    custodian.baseUrl = baseUrl;
  }

  /// @notice Checks the signature of the given message hash to be from a known operator
  /// @param custodian The custodian storage slot
  /// @param messageHash The message hash to be checked
  /// @param signature The signature to be checked
  /// @returns True if the signature is valid, false otherwise
  function checkSignature(
    Custodian storage custodian,
    bytes32 messageHash,
    bytes memory signature
  ) internal view returns (bool) {
    address signer = messageHash.toEthSignedMessageHash().recover(signature);
    return custodian.operators.contains(uint256(uint160(address(signer))));
  }

  /// @notice Check if the given address is an operator of the custodian
  /// @param custodian The custodian storage slot
  /// @param operator The address to be checked
  /// @returns True if the address is an operator, false otherwise
  function hasOperator(Custodian storage custodian, address operator) internal view returns (bool) {
    return custodian.operators.contains(uint256(uint160(address(operator))));
  }

  /// @notice Adds an operator to the custodian
  /// @param custodian The custodian storage slot
  /// @param operator The address of the operator to be added
  function addOperator(Custodian storage custodian, address operator) internal {
    custodian.operators.set(uint256(uint160(address(operator))), operator);
  }

  /// @notice Removes an operator from the custodian
  /// @param custodian The custodian storage slot
  /// @param operator The address of the operator to be removed
  function removeOperator(Custodian storage custodian, address operator) internal {
    custodian.operators.remove(uint256(uint160(address(operator))));
  }

  /// @notice Returns the list of all operators of the custodian
  /// @param custodian The custodian storage slot
  function getOperators(Custodian storage custodian) internal view returns (address[] memory) {
    uint256 numberOfOperators = custodian.operators.length();
    address[] memory addresses = new address[](numberOfOperators);

    for (uint256 i = 0; i < numberOfOperators; i++) {
      (, addresses[i]) = custodian.operators.at(i);
    }
    return addresses;
  }
}
