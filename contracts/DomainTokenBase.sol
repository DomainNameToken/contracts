/// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import { MintInformations } from './libraries/MintInformation.sol';

import { Domains } from './libraries/Domain.sol';
import { Destroyable } from "./Destroyable.sol";
import { ICustodian } from './interfaces/ICustodian.sol';
import { IDomainTokenBase } from './interfaces/IDomainTokenBase.sol';



contract DomainTokenBase is ERC721Enumerable, Destroyable, IDomainTokenBase {

    using MintInformations for MintInformations.MintInformation;
    using Domains for Domains.Domain;
    
    ICustodian public custodian;
    
    mapping(uint256=>uint256) public _nonces;

    mapping(uint256=>Domains.Domain) public domains;
    
    constructor(address _custodian) ERC721("Domains", "DOMAIN"){
        custodian = ICustodian(_custodian);
    }
    
    function _baseURI() override internal view returns(string memory) {
        return custodian.baseUrl();
    }

    function name() override public view returns(string memory){
        return string(abi.encodePacked(custodian.name(), " ",super.name()));
    }
    
    function setCustodian(address _custodian) override external onlyOwner {
        custodian = ICustodian(_custodian);
    }

    
    function _isValidNonce(uint256 tokenId, uint256 nonce) internal view returns(bool) {
        return _nonces[tokenId] < nonce;
    }

    function _updateNonce(MintInformations.MintInformation memory info) internal {
        _nonces[info.tokenId] = info.nonce;
    }

    function _isValidTokenId(MintInformations.MintInformation memory info) internal pure returns(bool){
        return uint256(keccak256(abi.encode(info.domainName))) == info.tokenId;
    }
    function getTokenNonce(uint256 tokenId) external view returns(uint256){
        return _nonces[tokenId];
    }
    
    function mint(MintInformations.MintInformation memory info, bytes memory signature) external returns(uint256){
        require(custodian
                .checkSignature(info.encode(),
                                signature));
        require(!_exists(info.tokenId));

        require(info.isValidInfo());
        
        require(_isValidNonce(info.tokenId, info.nonce));
        
        require(info.isValidBlock());

        require(_isValidTokenId(info));


        Domains.Domain memory domain = Domains.Domain({
                
            name: info.domainName,
                    expiryTime: info.expiryTime,
                    lockTime: block.timestamp,
                    custodianLock: 0,
                    withdrawInitiated: 0
                    });

            domains[info.tokenId] = domain;
            
        _updateNonce(info);

        _mint(info.destinationOwner, info.tokenId);
        return info.tokenId;
    }

     function _beforeTokenTransfer(
        address,
        address to,
        uint256 tokenId
    ) internal override {
         if(to != address(0)){
             require(domains[tokenId].canTransfer(), "Can not transfer");
         }
     }

     function setLock(uint256 tokenId, bool status) override external {
         require(_exists(tokenId));
         require(_isApprovedOrOwner(msg.sender, tokenId), "not owner of domain");
         
         domains[tokenId].setLock(status);
         
     }
     
     modifier onlyOperator(){
         require( msg.sender == address(custodian)
                 || msg.sender == custodian.getOwner()
                 || custodian.isOperator(msg.sender), "Not operator");
         _;
     }

     function setCustodianLock(uint256 tokenId, bool status) override external  onlyOperator {
         domains[tokenId].setCustodianLock(status);
         emit CustodianLock(tokenId, domains[tokenId].custodianLock);
     }
     
     event CustodianLock(uint256 tokenId, uint256 timestamp);
     event WithdrawRequest(uint256 tokenId, address sender);
     event WithdrawFulfilled(uint256 tokenId, string domainName);
     function requestWithdraw(uint256 tokenId) override external {
         require(_exists(tokenId), "token does not exist");
         require(_isApprovedOrOwner(msg.sender, tokenId), "not owner of domain");
         require(domains[tokenId].isNotLocked(), "domain locked");
         require(custodian.isActiveUser(msg.sender), "not active user");

         domains[tokenId].setWithdraw(true);
         emit WithdrawRequest(tokenId, msg.sender);
     }

     function cancelWithdrawRequest(uint256 tokenId) override external onlyOperator {
         
         require(_exists(tokenId), "token does not exist");
         domains[tokenId].setWithdraw(false);
         
     }

     function fulfillWithdraw(uint256 tokenId) override external onlyOperator {
         require(!domains[tokenId].isNotWithdrawing());
         emit WithdrawFulfilled(tokenId, domains[tokenId].name);
         delete domains[tokenId];
         _burn(tokenId);

     }

     function getDomainInfo(uint256 tokenId) override external view returns(Domains.Domain memory) {
         return domains[tokenId];
     }

     function getTokenIdByName(string memory domainName) override external view returns(uint256) {
         return Domains.domainNameToId(domainName);
     }
     
}
