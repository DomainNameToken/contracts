// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import {CustodianLib} from "./libraries/Custodian.sol";
import {ICustodian} from "./interfaces/ICustodian.sol";
import {Destroyable} from "./Destroyable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {BytesDecoder} from "./libraries/BytesDecoder.sol";

contract CustodianImplementationV2 is ICustodian, Destroyable, Initializable {
  using CustodianLib for CustodianLib.Custodian;
  using BytesDecoder for bytes;
  using EnumerableMap for EnumerableMap.Bytes32ToBytes32Map;
  CustodianLib.Custodian private custodian;
  mapping(bytes32 => uint256) _nonces;
  EnumerableMap.Bytes32ToBytes32Map private enabledTlds;
  mapping(bytes32 => string) public tlds;
  string public pgpPublicKey;

  constructor() {}

  function initialize(string memory _name, string memory _baseUrl) public initializer {
    custodian.setName(_name);
    custodian.setBaseUrl(_baseUrl);
  }

  function setCustodianInfo(string memory _name, string memory _baseUrl)
    external
    override
    onlyOwner
  {
    custodian.setName(_name);
    custodian.setBaseUrl(_baseUrl);
  }

  function name() external view override returns (string memory) {
    return custodian.name;
  }

  function baseUrl() external view override returns (string memory) {
    return custodian.baseUrl;
  }

  modifier onlyOperator() {
    require(msg.sender == owner() || custodian.hasOperator(msg.sender));
    _;
  }

  function setPgpPublicKey(string memory _pgpPublicKey) external override onlyOwner {
    pgpPublicKey = _pgpPublicKey;
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
    return operator == address(this) || custodian.hasOperator(operator);
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

  function disableTlds(string[] memory tlds_) external override onlyOperator {
    for (uint256 i = 0; i < tlds_.length; i++) {
      bytes32 tldKey = keccak256(abi.encode(tlds_[i]));
      if (enabledTlds.contains(tldKey)) {
        enabledTlds.remove(tldKey);
      }
    }
  }

  function isTldEnabled(string memory tld) external view override returns (bool) {
    bytes32 tldKey = keccak256(abi.encode(tld));
    return enabledTlds.contains(tldKey);
  }

  function isTldEnabled(bytes32 tldKey) external view override returns (bool) {
    return enabledTlds.contains(tldKey);
  }

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
