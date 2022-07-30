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
import {IDomain} from "./interfaces/IDomain.sol";

contract DomainImplementationV2 is ERC721Enumerable, Destroyable, IDomain, Initializable {
  using Domain for DataStructs.Domain;
  ICustodian public custodian;
  mapping(uint256 => DataStructs.Domain) public domains;
  string private _name;
  string private _symbol;
  string private NAME_SEPARATOR = " ";
  string private SYMBOL_SEPARATOR = "-";

  modifier onlyCustodian() {
    require(msg.sender == address(custodian) || custodian.isOperator(msg.sender), "only custodian");
    _;
  }

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

  /// @notice Sets domain name and symbol configuration
  /// @dev can be called only by contract owner
  /// @param name_ The name of the token
  /// @param symbol_ The symbol of the token
  /// @param nameSeparator_ The separator used to separate the custodian name and the token name
  /// @param symbolSeparator_ The separator used to separate the custodian name and the token symbol
  function setNameSymbolAndSeparators(
    string memory name_,
    string memory symbol_,
    string memory nameSeparator_,
    string memory symbolSeparator_
  ) public onlyOwner {
    _name = name_;
    _symbol = symbol_;
    NAME_SEPARATOR = nameSeparator_;
    SYMBOL_SEPARATOR = symbolSeparator_;
  }

  /// @notice Get the token name
  /// @dev The token name is constructed using the custodian name and the token name separated by the NAME_SEPARATOR
  /// @return The token name
  function name() public view override returns (string memory) {
    return string(abi.encodePacked(custodian.name(), NAME_SEPARATOR, _name));
  }

  /// @notice Get the token symbol
  /// @dev The token symbol is constructed using the custodian name and the token symbol separated by the SYMBOL_SEPARATOR
  /// @return The token symbol
  function symbol() public view override returns (string memory) {
    return string(abi.encodePacked(_symbol, SYMBOL_SEPARATOR, custodian.name()));
  }

  /// @notice Set custodian contract address
  /// @dev can be called only by contract owner
  /// @param _custodian The address of the custodian contract
  function setCustodian(address _custodian) external override onlyOwner {
    custodian = ICustodian(_custodian);
  }

  function _isValidTokenId(DataStructs.Information memory info) internal pure returns (bool) {
    return uint256(keccak256(abi.encode(info.domainName))) == info.tokenId;
  }

  /// @notice Check if the tokenId exists
  /// @param tokenId The tokenId to check
  /// @return True if the tokenId exists, false otherwise
  function exists(uint256 tokenId) external view override returns (bool) {
    return _exists(tokenId);
  }

  /// @notice Set new expiration time for a domain
  /// @dev can be called only by custodian
  /// @dev emits DomainExtended event on success
  /// @param info Extension information
  function extend(DataStructs.Information memory info) external override onlyCustodian {
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

  /// @notice Mint a new tokenId
  /// @dev can be called only by custodian
  /// @dev will mint the tokenId associated to the domain name if it was not previosly minted
  /// @dev emits DomainMinted event on success
  function mint(DataStructs.Information memory info)
    external
    override
    onlyCustodian
    returns (uint256)
  {
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
    emit DomainMinted(info.tokenId, info.owner, info.expiry, domains[info.tokenId].name);
    return info.tokenId;
  }

  /// @notice Burn a tokenId
  /// @dev can be called only by custodian
  /// @dev will emit DomainBurned event on success
  function burn(DataStructs.Information memory info) external override onlyCustodian {
    require(_exists(info.tokenId), "Token does not exist");
    require(BurnInformation.isValidInfo(info), "Is not valid info");
    require(domains[info.tokenId].isNotLocked(), "Domain Locked");

    emit DomainBurned(info.tokenId, domains[info.tokenId].expiry, domains[info.tokenId].name);

    delete domains[info.tokenId];
    _burn(info.tokenId);
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 tokenId
  ) internal view override {
    /// @dev a domain token can not be transferred if it is locked, frozen or expired
    if (to != address(0) && from != address(0) && !custodian.isOperator(msg.sender)) {
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

  /// @notice Request to withdraw the token from custodian.
  /// @dev only the owner or approved address can request to withdraw the domain name
  /// @dev will emit WithdrawRequest event on success
  /// @dev the token must be transferrable
  /// @param tokenId The tokenId to withdraw
  function withdraw(uint256 tokenId) external override {
    require(_exists(tokenId), "Domain does no exist");
    require(_isApprovedOrOwner(msg.sender, tokenId), "not owner of domain");
    require(domains[tokenId].isNotLocked(), "Domain is locked");
    require(domains[tokenId].isNotFrozen(), "Domain is frozen");
    require(domains[tokenId].isNotExpired(), "Domain is expired");
    domains[tokenId].setFreeze(true);
    emit WithdrawRequest(tokenId, ownerOf(tokenId));
  }

  /// @notice Get the domain information for a token id
  /// @param tokenId The tokenId to get the information for
  /// @return The domain information
  function getDomainInfo(uint256 tokenId)
    external
    view
    override
    returns (DataStructs.Domain memory)
  {
    return domains[tokenId];
  }

  /// @notice Check if the domain token is locked
  /// @param tokenId The tokenId to check
  /// @return True if the token is locked, false otherwise
  function isLocked(uint256 tokenId) external view override returns (bool) {
    return !domains[tokenId].isNotLocked();
  }

  /// @notice Check if the domain token is frozen
  /// @param tokenId The tokenId to check
  /// @return True if the token is frozen, false otherwise
  function isFrozen(uint256 tokenId) external view override returns (bool) {
    return !domains[tokenId].isNotFrozen();
  }
}
