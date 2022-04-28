// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library BurnInformations {

    struct Source {
        uint256 chainId;
        address owner;
        uint256 blockNumber;
        uint256 blockNumberTTL;
    }
    
    struct BurnInformation {
        uint256 tokenId;
        Source destination;
        Source source;
        uint256 nonce;
        string domainName;
        uint256 expiryTime;
    }
    
    function encode(BurnInformation memory info) internal pure returns(bytes32) {
         return keccak256(abi
                          .encode(
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

    function isValidInfo(BurnInformation memory info) internal view returns(bool) {
        return info.tokenId == uint256(keccak256(abi.encode(info.domainName)))
            && info.expiryTime > block.timestamp
            && info.source.owner != address(0);
    }
    
    function isValidChainId(BurnInformation memory info, uint256 expectedChainId) internal pure returns(bool) {
        return expectedChainId == info.source.chainId;
    }
    
    
    function isValidBlock(BurnInformation memory info) internal view returns(bool) {
        return  block.number >= info.source.blockNumber
                && block.number <= info.source.blockNumber + info.source.blockNumberTTL;
    }
}
