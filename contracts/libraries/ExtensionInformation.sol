// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library ExtensionInformations {

    struct Source {
        uint256 chainId;
        address owner;
        uint256 blockNumber;
        uint256 blockNumberTTL;
    }
    
    struct ExtensionInformation {
        uint256 messageType;
        address custodian;
        uint256 tokenId;
        Source destination;
        Source source;
        uint256 nonce;
        string domainName;
        uint256 expiryTime;
    }

    function MESSAGE_TYPE() internal pure returns(uint256) {
        return uint256(keccak256(abi.encode("dnt.domain.messagetype.extension")));
        
    }
    
    function encode(ExtensionInformation memory info) internal pure returns(bytes32) {
         return keccak256(abi
                          .encode(
                                  MESSAGE_TYPE(),
                                  info.custodian,
                                  info.tokenId,
                                  
                                  info.destination.chainId,
                                  info.destination.owner,
                                  info.destination.blockNumber,
                                  info.destination.blockNumberTTL,
                                  
                                  info.source.chainId,
                                  info.source.owner,
                                  info.source.blockNumber,
                                  info.source.blockNumberTTL,
                                  
                                  info.nonce,
                                  info.domainName,
                                  info.expiryTime));
    }

    function isValidInfo(ExtensionInformation memory info) internal view returns(bool) {
        return info.tokenId == uint256(keccak256(abi.encode(info.domainName)))
            && info.expiryTime > block.timestamp
              && info.source.owner != address(0)
            && info.source.owner == info.destination.owner
            && info.messageType == MESSAGE_TYPE();
    }
    
    function isValidChainId(ExtensionInformation memory info, uint256 expectedChainId) internal pure returns(bool) {
        return expectedChainId == info.source.chainId;
    }

    function isValidCustodian(ExtensionInformation memory info, address expectedCustodian) internal pure returns(bool) {
        return expectedCustodian == info.custodian;
    }
    
    function isValidBlock(ExtensionInformation memory info) internal view returns(bool) {
        return  block.number >= info.source.blockNumber
                && block.number <= info.source.blockNumber + info.source.blockNumberTTL
            && block.number >= info.destination.blockNumber
            && block.number <= info.destination.blockNumber + info.destination.blockNumberTTL;
    }
}
