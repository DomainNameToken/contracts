// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import {CustodianLib} from "./libraries/Custodian.sol";
import {ICustodian} from "./interfaces/ICustodian.sol";
import {Destroyable} from "./Destroyable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {BytesDecoder} from "./libraries/BytesDecoder.sol";

/// @title Custodian Implementation
/// @notice This contract is used to identify operators and manage domain tokens
contract CustodianImplementationV2 is ICustodian, Destroyable, Initializable {
  using CustodianLib for CustodianLib.Custodian;
  using BytesDecoder for bytes;
  using EnumerableMap for EnumerableMap.Bytes32ToBytes32Map;
  CustodianLib.Custodian private custodian;

  // Current expected minimum nonce for each group
  mapping(bytes32 => uint256) _nonces;

  // enabled tlds list
  EnumerableMap.Bytes32ToBytes32Map private enabledTlds;

  // Index of bytes32 keccak256(encode.abi(tldString)) to tldString
  mapping(bytes32 => string) public tlds;

  // Custodian PGP Public Key
  // This is the PGP public key of the custodian. It should be used to encrypt all orders data.
  string public pgpPublicKey;

  constructor() {}

  function initialize(string memory _name, string memory _baseUrl) public initializer {
    custodian.setName(_name);
    custodian.setBaseUrl(_baseUrl);
  }

  /**
    @notice Set custodian information
    @dev Set the name and base URL of the custodian. Can be called only by owner of contract.
    @param _name The name of the custodian.
    @param _baseUrl The base URL of the custodian. 
   */
  function setCustodianInfo(string memory _name, string memory _baseUrl)
    external
    override
    onlyOwner
  {
    custodian.setName(_name);
    custodian.setBaseUrl(_baseUrl);
  }

  /**
    @notice Get custodian name
    @dev Get the name of the custodian.
    @return The name of the custodian.
   */
  function name() external view override returns (string memory) {
    return custodian.name;
  }

  /**
     @notice Get custodian base URL
     @dev Get the base URL of the custodian.
     @return The base URL of the custodian.
  */
  function baseUrl() external view override returns (string memory) {
    return custodian.baseUrl;
  }

  /**
     @notice Modifier to accept only owner of contract or any of the custodian's operators.
   */
  modifier onlyOperator() {
    require(msg.sender == owner() || custodian.hasOperator(msg.sender));
    _;
  }

  /**
    @notice Set the PGP public key of the custodian.
    @dev Set the PGP public key of the custodian.
    @param _pgpPublicKey The PGP public key of the custodian.
   */
  function setPgpPublicKey(string memory _pgpPublicKey) external override onlyOwner {
    pgpPublicKey = _pgpPublicKey;
  }

  /**
     @notice Adds a new operator to the custodian.
     @dev Adds a new operator to the custodian.
     @param operator The new operator address.
   */
  function addOperator(address operator) external override onlyOwner {
    custodian.addOperator(operator);
    emit OperatorAdded(operator);
  }

  /**
     @notice Removes an operator from the custodian.
     @dev Removes an operator from the custodian.
     @param operator The operator address.
  */
  function removeOperator(address operator) external override onlyOwner {
    custodian.removeOperator(operator);
    emit OperatorRemoved(operator);
  }

  /**
     @notice Gets the list of operators of the custodian.
     @dev Gets the list of operators of the custodian.
     @return The list of operators of the custodian.
   */
  function getOperators() external view override returns (address[] memory) {
    return custodian.getOperators();
  }

  /**
     @notice Checks if an operator is an operator of the custodian.
     @dev Checks if an operator is an operator of the custodian.
     @param operator The operator address.
     @return True if the operator is an operator of the custodian, false otherwise.
  */
  function isOperator(address operator) external view override returns (bool) {
    return operator == address(this) || custodian.hasOperator(operator);
  }

  /**
    @notice Checks if provided signature is made by one of custodian's operator.
    @dev Checks if provided signature is made by one of custodian's operator.
    @param messageHash The hash of the message.
    @param signature The signature.
    @return True if the signature is made by one of custodian's operator, false otherwise.
   */
  function checkSignature(bytes32 messageHash, bytes memory signature)
    external
    view
    override
    returns (bool)
  {
    return custodian.checkSignature(messageHash, signature);
  }

  /**
    @notice Get the current nonce for provided group
    @dev Get the current nonce for provided group.
    @param group The group.
    @return The current nonce for provided group.
   */
  function _nonce(bytes32 group) external view override returns (uint256) {
    return _nonces[group];
  }

  /**
     @notice Call an external contract with provided data. Will forward msg.value along with the contract call. Can be called only by one of the custodian's operators.
     @dev Call an external contract with provided data.
     @param _contract The address of the contract to call.
     @param data The call data
   */
  function externalCall(address _contract, bytes memory data)
    external
    payable
    override
    onlyOperator
    returns (bytes memory)
  {
    (bool success, bytes memory response) = _contract.call{value: msg.value}(data);
    if (!success) {
      revert(response.extractRevertReason());
    }
    return response;
  }

  function checkExternalCallPermit(
    address _contract,
    bytes memory data,
    bytes memory signature,
    bytes32 signatureNonceGroup,
    uint256 signatureNonce
  ) internal view returns (bool) {
    if (_nonces[signatureNonceGroup] >= signatureNonce) {
      return false;
    }

    bytes32 hash = keccak256(abi.encode(_contract, data, signatureNonceGroup, signatureNonce));
    return custodian.checkSignature(hash, signature);
  }

  /**
     @notice Call an external contract with provided data. Will forward msg.value along with the contract call. Can be called by any address. 
     @dev Call an external contract with provided data.
     @param _contract The address of the contract to call.
     @param data The call data
     @param signature The signature. Signature made by one of the custodian's operators.
     @param signatureNonceGroup The signature nonce group.
     @param signatureNonce The signature nonce.
  */
  function externalCallWithPermit(
    address _contract,
    bytes memory data,
    bytes memory signature,
    bytes32 signatureNonceGroup,
    uint256 signatureNonce
  ) external payable override returns (bytes memory) {
    if (!checkExternalCallPermit(_contract, data, signature, signatureNonceGroup, signatureNonce)) {
      revert("Unable to check call signature");
    }
    (bool success, bytes memory response) = _contract.call{value: msg.value}(data);
    if (!success) {
      revert(response.extractRevertReason());
    }
    return response;
  }

  /**
   @notice Enables a list of tlds. Can be called only by operators
   @dev Enables a list of tlds.
   @param tlds_ The list of tlds.
  */
  function enableTlds(string[] memory tlds_) external override onlyOperator {
    for (uint256 i = 0; i < tlds_.length; i++) {
      bytes32 tldKey = keccak256(abi.encode(tlds_[i]));
      if (!enabledTlds.contains(tldKey)) {
        enabledTlds.set(tldKey, tldKey);
      }
      if (bytes(tlds[tldKey]).length == 0) {
        tlds[tldKey] = tlds_[i];
      }
    }
  }

  /**
     @notice Disables a list of tlds. Can be called only by operators
     @dev Disables a list of tlds.
     @param tlds_ The list of tlds.
  */
  function disableTlds(string[] memory tlds_) external override onlyOperator {
    for (uint256 i = 0; i < tlds_.length; i++) {
      bytes32 tldKey = keccak256(abi.encode(tlds_[i]));
      if (enabledTlds.contains(tldKey)) {
        enabledTlds.remove(tldKey);
      }
    }
  }

  /**
     @notice Check if a tld is enabled.
     @dev Check if a tld is enabled.
     @param tld The tld.
     @return True if the tld is enabled, false otherwise.
   */
  function isTldEnabled(string memory tld) external view override returns (bool) {
    bytes32 tldKey = keccak256(abi.encode(tld));
    return enabledTlds.contains(tldKey);
  }

  /**
     @notice Check if a tld is enabled.
     @dev Check if a tld is enabled.
     @param tldKey The encoded tld.
     @return True if the tld is enabled, false otherwise.
   */
  function isTldEnabled(bytes32 tldKey) external view override returns (bool) {
    return enabledTlds.contains(tldKey);
  }

  /**
     @notice Gets the list of enabled tlds.
     @dev Gets the list of enabled tlds.
     @return The list of enabled tlds.
  */
  function getTlds() external view override returns (string[] memory) {
    uint256 length = enabledTlds.length();
    string[] memory _tlds = new string[](length);

    for (uint256 i = 0; i < length; i++) {
      (bytes32 k, ) = enabledTlds.at(i);
      _tlds[i] = tlds[k];
    }
    return _tlds;
  }
}
