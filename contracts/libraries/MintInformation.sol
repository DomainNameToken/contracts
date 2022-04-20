// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library MintInformation {
    struct MintInformation {
        uint256 tokenId;
        uint256 destinationChainId;               
        address destinationOwner;
        uint256 destinationBlock;
        uint256 destinationBlockTTL;
        uint256 nonce;
        string domainName;
        uint256 expiryTime;
    }
    
    function encode(MintInformation memory info) internal returns(bytes32) {
         return keccak256(abi
                          .encodePacked(info.custodianIdentity,
                                        info.tokenId,
                                        info.destinationChainId,
                                        info.destinationOwner,
                                        info.destinationBlock,
                                        info.destinationBlockTTL,
                                        info.nonce,
                                        info.domainName,
                                        info.expiryTime));
    }

    function isValidInfo(MintInformation memory info) internal returns(bool) {
        return info.tokenId == uint256(keccak256(abi.encode(info.domainName)))
            && info.expiryTime > block.timestamp
            && info.destinationOwner != address(0);
    }
    
    
    function isValidBlock(MintInformation.MintInformation memory info) internal view returns(bool) {
        return (block.chainid == info.destinationChainId
                && block.number >= info.destinationBlock
                && block.number <= info.destinationBlock + info.destinationBlockTTL;
    }
}
