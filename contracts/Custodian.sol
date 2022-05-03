// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {CustodianLib} from "./libraries/Custodian.sol";
import {ICustodian} from "./interfaces/ICustodian.sol";
import {Destroyable} from "./Destroyable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IUser} from "./interfaces/IUser.sol";

contract CustodianImplementationV1 is ICustodian, Destroyable, Initializable {
  using CustodianLib for CustodianLib.Custodian;
  CustodianLib.Custodian private custodian;
  mapping(bytes32 => uint256) _nonces;

  constructor() {}

  function initialize(
    string memory _name,
    string memory _baseUrl,
    address _users
  ) public initializer {
    custodian.setName(_name);
    custodian.setBaseUrl(_baseUrl);
    custodian.setUsers(_users);
  }

  function setCustodianInfo(
    string memory _name,
    string memory _baseUrl,
    address _users
  ) external override onlyOwner {
    custodian.setName(_name);
    custodian.setBaseUrl(_baseUrl);
    custodian.setUsers(_users);
  }

  function name() external view override returns (string memory) {
    return custodian.name;
  }

  function baseUrl() external view override returns (string memory) {
    return custodian.baseUrl;
  }

  function users() external view override returns (IUser) {
    return custodian.users;
  }

  modifier onlyOperator() {
    require(msg.sender == owner() || custodian.hasOperator(msg.sender));
    _;
  }

  function addOperator(address operator) external override onlyOwner {
    custodian.addOperator(operator);
    emit OperatorAdded(operator);
  }

  function removeOperator(address operator) external override onlyOwner {
    custodian.removeOperator(operator);
    emit OperatorRemoved(operator);
  }

  function getOperators() external view override returns (address[] memory) {
    return custodian.getOperators();
  }

  function isOperator(address operator) external view override returns (bool) {
    return custodian.hasOperator(operator);
  }

  function checkSignature(bytes32 messageHash, bytes memory signature)
    external
    view
    override
    returns (bool)
  {
    return custodian.checkSignature(messageHash, signature);
  }

  function _nonce(bytes32 group) external view override returns (uint256) {
    return _nonces[group];
  }

  function extractRevertReason(bytes memory revertData)
    internal
    pure
    returns (string memory reason)
  {
    uint256 l = revertData.length;
    if (l < 68) return "";
    uint256 t;
    assembly {
      revertData := add(revertData, 4)
      t := mload(revertData) // Save the content of the length slot
      mstore(revertData, sub(l, 4)) // Set proper length
    }
    reason = abi.decode(revertData, (string));
    assembly {
      mstore(revertData, t) // Restore the content of the length slot
    }
  }

  function externalCall(address _contract, bytes memory data)
    external
    payable
    override
    onlyOperator
    returns (bytes memory)
  {
    (bool success, bytes memory response) = _contract.call{value: msg.value}(data);
    if (!success) {
      revert(extractRevertReason(response));
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
    if (_nonces[signatureNonceGroup] < signatureNonce) {
      return false;
    }

    bytes32 hash = keccak256(abi.encode(_contract, data, signatureNonceGroup, signatureNonce));
    return custodian.checkSignature(hash, signature);
  }

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
      revert(extractRevertReason(response));
    }
    return response;
  }
}
