/// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import { DataStructs } from './libraries/DataStructs.sol';
import { MintInformations } from './libraries/MintInformation.sol';
import { BurnInformations } from './libraries/BurnInformation.sol';
import { ExtensionInformations } from './libraries/ExtensionInformation.sol';

import { Domains } from './libraries/Domain.sol';
import { Destroyable } from "./Destroyable.sol";
import { ICustodian } from './interfaces/ICustodian.sol';
import { IDomainTokenBase } from './interfaces/IDomainTokenBase.sol';



contract DomainTokenBase is ERC721Enumerable, Destroyable, IDomainTokenBase, Initializable {
    
    using Domains for Domains.Domain;
    
    ICustodian public custodian;
    
    mapping(uint256=>uint256) public _nonces;

    mapping(uint256=>Domains.Domain) public domains;

    string private _name;
    string private _symbol;
    uint256 private _chainId;

    
    constructor() ERC721Enumerable() ERC721('DOMAIN', 'Domains')  {
        
    }

    function initialize(address _custodian, string memory symbol_, string memory name_, uint256 chainId_) public initializer {
        custodian = ICustodian(_custodian);
        _name = name_;
        _symbol = symbol_;
        _chainId = chainId_;
    }
    
    function _baseURI() override internal view returns(string memory) {
        return custodian.baseUrl();
    }

    function name() override public view returns(string memory){
        return string(abi.encodePacked(custodian.name(), " ",_name));
    }

    function symbol() override public view returns(string memory) {
        return string(abi.encodePacked(_symbol,"-",custodian.name()));
    }
    
    function setCustodian(address _custodian) override external onlyOwner {
        custodian = ICustodian(_custodian);
    }
    
    function _updateNonce(uint256 tokenId, uint256 nonce) internal {
        require(nonce > _nonces[tokenId], "invalid nonce");
        _nonces[tokenId] = nonce;
    }

    function _isValidTokenId(DataStructs..Information memory info) internal pure returns(bool){
        return uint256(keccak256(abi.encode(info.domainName))) == info.tokenId;
    }
    function getTokenNonce(uint256 tokenId) external view returns(uint256){
        return _nonces[tokenId];
    }

    function exists(uint256 tokenId) external view returns(bool) {
        return _exists(tokenId);
    }
    function chainId() external view returns(uint256) {
        return _chainId;
    }
    
    function extend(DataStructs.Information memory info) external onlyCustodian {
        require(_exists(info.tokenId), "Token does not exist");
        
        require(ExtensionInformation.isValidInfo(info), "Is not valid info");
        require(ExtensionInformation.isValidChainId(info,_chainId), "Is not valid chain");
                
        require(ExtensionInformation.isValidBlock(info), "Is Not Valid Block");

        domains[info.tokenId].updateExpiry(info.expiryTime);
        
        emit DomainExtended(_chainId, info.tokenId, info.source.chainId, info.destination.chainId, info.source.owner, info.destination.owner, domains[info.tokenId].expiryTime, domains[info.tokenId].withdrawLocktime, domains[info.tokenId].name);

        
    }
    
    function mint(DataStructs.Information memory info, bytes memory signature) external onlyCustodian returns(uint256){

        require(!_exists(info.tokenId), "Token Exists");
        
        require(MintInformation.isValidInfo(info), "Is not valid info");
        require(MintInformation.isValidChainId(info,_chainId), "Is not valid chain");
                
        require(MintInformation.isValidBlock(info), "Is Not Valid Block");

        require(_isValidTokenId(info), "Is Not Valid Token Id");


        Domains.Domain memory domain = Domains.Domain({
                
            name: info.domainName,
                    expiryTime: info.expiryTime,
                    lockTime: block.timestamp,
                    custodianLock: 0,
              withdrawInitiated: 0,
              withdrawLocktime: info.withdrawLocktime
                    });

            domains[info.tokenId] = domain;
            
        _mint(info.destination.owner, info.tokenId);
        emit DomainMinted(_chainId, info.tokenId, info.source.chainId, info.destination.chainId, info.source.owner, info.destination.owner, info.expiryTime, domains[info.tokenId].withdrawLocktime, domains[info.tokenId].name);
        return info.tokenId;
    }

    
    function burn(DataStructs.formation memory info, bytes memory signature) external onlyCustodian {

        require(_exists(info.tokenId), "Token does not exist");
        require(BurnInformation.isValidInfo(info), "Is not valid info");
        require(BurnInformation.isValidChainId(info, _chainId), "Is not valid chain");
        
        require(BurnInformation.isValidBlock(info), "Is Not Valid Block");

        require(domains[info.tokenId].isNotLocked(), "Domain Locked");

        require(_isApprovedOrOwner(info.source.owner, info.tokenId), "not owner of domain"); // ??
        
        emit DomainBurned(_chainId, info.tokenId, info.source.chainId, info.destination.chainId, info.source.owner, info.destination.owner, domains[info.tokenId].expiryTime, domains[info.tokenId].withdrawLocktime, domains[info.tokenId].name);
        
        delete domains[info.tokenId];
        _burn(info.tokenId);
        
        
    }
    
    modifier onlyCustodian() {
        require(msg.sender == address(custodian), "only custodian");
        _;
    }
    
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal view override {
         if(to != address(0) && from != address(0)){
             require(domains[tokenId].isNotLocked(), "Domain is locked");
             require(domains[tokenId].isNotCustodianLocked(), "Domain is locked by custodian");
             require(domains[tokenId].isNotWithdrawing(), "Domain is being withdrawn");
             require(domains[tokenId].isNotExpired(), "Domain is expired");
         }
     }

    function setLock(uint256 tokenId, bool status) override external {
      require(_exists(tokenId), "token does not exist");
      require(_isApprovedOrOwner(msg.sender, tokenId), "not owner of domain");
      
      domains[tokenId].setLock(status);
         
    }
     
     function setCustodianLock(uint256 tokenId, bool status) override external  onlyCustodian {
       require(_exists(tokenId), "Domain does not exist");
         domains[tokenId].setCustodianLock(status);
         emit CustodianLock(_chainId, tokenId, domains[tokenId].custodianLock);
     }

     /* custodian should set the flag and custumer to interact with custodian contract */
     function requestWithdraw(uint256 tokenId) override external {
         require(_exists(tokenId), "token does not exist");
         require(_isApprovedOrOwner(msg.sender, tokenId), "not owner of domain");
         require(custodian.users.isActiveUser(msg.sender), "not active user");
         require(domains[tokenId].isNotLocked(), "Domain is locked");
         require(domains[tokenId].canInitiateWithdraw(), "can not initiate withdraw");
         domains[tokenId].setWithdraw(true);
         emit WithdrawRequest(_chainId, tokenId, msg.sender);
     }

     function cancelWithdrawRequest(uint256 tokenId) override external onlyCustodian {         
         require(_exists(tokenId), "token does not exist");
         domains[tokenId].setWithdraw(false);
         emit WithdrawCancel(_chainId, tokenId);
     }

     function fulfillWithdraw(uint256 tokenId) override external onlyCustodian {
       require(_exists(tokenId), "token does not exist");
       require(!domains[tokenId].isNotWithdrawing(), "not withdrawing");
         emit WithdrawFulfilled(_chainId, tokenId, domains[tokenId].name);
         delete domains[tokenId];
         _burn(tokenId);
     }

     function getDomainInfo(uint256 tokenId) override external view returns(Domains.Domain memory) {
         return domains[tokenId];
     }

     function getTokenIdByName(string memory domainName) override external pure returns(uint256) {
         return Domains.domainNameToId(domainName);
     }
     function isLocked(uint256 tokenId) external view returns(bool) {
       return !domains[tokenId].isNotLocked();
     }
     function isCustodianLocked(uint256 tokenId) external view returns(bool) {
       return !domains[tokenId].isNotCustodianLocked();
     }
     function isWithdrawing(uint256 tokenId) external view returns(bool) {
       return !domains[tokenId].isNotWithdrawing();
     }
}
