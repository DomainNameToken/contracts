/// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import {DataStructs} from "./libraries/DataStructs.sol";
import {MintInformation} from "./libraries/MintInformation.sol";
import {BurnInformation} from "./libraries/BurnInformation.sol";
import {ExtensionInformation} from "./libraries/ExtensionInformation.sol";

import {Domain} from "./libraries/Domain.sol";
import {Destroyable} from "./Destroyable.sol";
import {ICustodian} from "./interfaces/ICustodian.sol";
import {IDomainTokenBase} from "./interfaces/IDomainTokenBase.sol";

contract DomainImplementationV2 is ERC721Enumerable, Destroyable, IDomainTokenBase, Initializable {
  using Domain for DataStructs.Domain;
  ICustodian public custodian;
  mapping(uint256 => DataStructs.Domain) public domains;
  string private _name;
  string private _symbol;
  string private NAME_SEPARATOR = " ";
  string private SYMBOL_SEPARATOR = "-";
  constructor() ERC721Enumerable() ERC721("DOMAIN", "Domains") {}

  function initialize(
    address custodian_,
    string memory symbol_,
    string memory name_,
    string memory nameSeparator_,
    string memory symbolSeparator_
  ) public initializer {
    custodian = ICustodian(custodian_);
    _name = name_;
    _symbol = symbol_;
    NAME_SEPARATOR = nameSeparator_;
    SYMBOL_SEPARATOR = symbolSeparator_;
  }

  function _baseURI() internal view override returns (string memory) {
    return custodian.baseUrl();
  }

  function setNameSymbolAndSeparators(
    string memory name_,
    string memory symbol_,
    string memory nameSeparator_,
    string memory symbolSeparator_
  ) public {
    _name = name_;
    _symbol = symbol_;
    NAME_SEPARATOR = nameSeparator_;
    SYMBOL_SEPARATOR = symbolSeparator_;
  }
  
  function name() public view override returns (string memory) {
    return string(abi.encodePacked(custodian.name(), NAME_SEPARATOR, _name));
  }

  function symbol() public view override returns (string memory) {
    return string(abi.encodePacked(_symbol, SYMBOL_SEPARATOR, custodian.name()));
  }

  function setCustodian(address _custodian) external override onlyOwner {
    custodian = ICustodian(_custodian);
  }

  function _isValidTokenId(DataStructs.Information memory info) internal pure returns (bool) {
    return uint256(keccak256(abi.encode(info.domainName))) == info.tokenId;
  }

  function exists(uint256 tokenId) external view returns (bool) {
    return _exists(tokenId);
  }

  function extend(DataStructs.Information memory info) external onlyCustodian {
    require(_exists(info.tokenId), "Token does not exist");

    require(ExtensionInformation.isValidInfo(info), "Is not valid info");

    domains[info.tokenId].updateExpiry(info.expiry);

    emit DomainExtended(
      info.tokenId,
      ownerOf(info.tokenId),
      domains[info.tokenId].expiry,
      domains[info.tokenId].name
    );
  }

  function mint(DataStructs.Information memory info) external onlyCustodian returns (uint256) {
    require(!_exists(info.tokenId), "Token Exists");

    require(MintInformation.isValidInfo(info), "Is not valid info");

    require(_isValidTokenId(info), "Is Not Valid Token Id");

    DataStructs.Domain memory domain = DataStructs.Domain({
      name: info.domainName,
      expiry: info.expiry,
      locked: block.timestamp,
      frozen: 0
    });

    domains[info.tokenId] = domain;

    _mint(info.owner, info.tokenId);
    emit DomainMinted(
      info.tokenId,
      info.owner,
      info.expiry,
      domains[info.tokenId].name
    );
    return info.tokenId;
  }

  function burn(DataStructs.Information memory info) external onlyCustodian {
    require(_exists(info.tokenId), "Token does not exist");
    require(BurnInformation.isValidInfo(info), "Is not valid info");
    require(domains[info.tokenId].isNotLocked(), "Domain Locked");

    emit DomainBurned(
      info.tokenId,
      domains[info.tokenId].expiry,
      domains[info.tokenId].name
    );

    delete domains[info.tokenId];
    _burn(info.tokenId);
  }

  modifier onlyCustodian() {
    require(msg.sender == address(custodian)
            || custodian.isOperator(msg.sender), "only custodian");
    _;
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 tokenId
  ) internal view override {
    if (to != address(0) && from != address(0)
        && !custodian.isOperator(msg.sender)) {
      require(domains[tokenId].isNotLocked(), "Domain is locked");
      require(domains[tokenId].isNotFrozen(), "Domain is frozen");
      require(domains[tokenId].isNotExpired(), "Domain is expired");
    }
  }

  function setLock(uint256 tokenId, bool status) external override {
    require(_exists(tokenId), "token does not exist");
    require(_isApprovedOrOwner(msg.sender, tokenId), "not owner of domain");
    domains[tokenId].setLock(status);
    emit DomainLock(tokenId, domains[tokenId].locked);
  }

  function setFreeze(uint256 tokenId, bool status) external override onlyCustodian {
    require(_exists(tokenId), "Domain does not exist");
    domains[tokenId].setFreeze(status);
    emit DomainFreeze(tokenId, domains[tokenId].frozen);
  }

  function withdraw(uint256 tokenId) external override {
    require(_exists(tokenId), "Domain does no exist");
    require(_isApprovedOrOwner(msg.sender, tokenId), "not owner of domain");
    require(domains[tokenId].isNotLocked(), "Domain is locked");
    require(domains[tokenId].isNotFrozen(), "Domain is frozen");
    require(domains[tokenId].isNotExpired(), "Domain is expired");
    domains[tokenId].setFreeze(true);
    emit WithdrawRequest(tokenId, ownerOf(tokenId));
  }

  function getDomainInfo(uint256 tokenId)
    external
    view
    override
    returns (DataStructs.Domain memory)
  {
    return domains[tokenId];
  }

  function isLocked(uint256 tokenId) external view override returns (bool) {
    return !domains[tokenId].isNotLocked();
  }

  function isFrozen(uint256 tokenId) external view override returns (bool) {
    return !domains[tokenId].isNotFrozen();
  }
}
