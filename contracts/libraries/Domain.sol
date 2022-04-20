// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Domain {
    struct Domain {
        string name;
        uint256 expiryTime;
        uint256 lockTime;
        uint256 custodianLock;
        uint256 withdrawInitiated;
    }

    function domainNameToId(string memory domainname) internal pure returns(uint256){
        return uint256(keccak256(abi.encode(domainName)));
    }
    
    function domainHash(Domain memory domain) internal pure returns(bytes32) {
        return keccak256(abi.encode(domain.name));
    }
    
    function getTokenId(Domain memory domain) internal pure returns(uint256){
        return uint256(keccak256(abi.encode(domain.name)));
    }
    function isNotLocked(Domain memory domain) internal pure returns (bool) {
        return domain.lockTime == 0;
    }
    function isNotExpired(Domain memory domain) internal view returns (bool) {
        return domain.expiryTime < block.timestamp;
    }

    function isNotCustodianLocked(Domain memory domain) internal pure returns(bool) {
        return domain.custodianLock == 0;
    }
    function isNotWithdrawing(Domain memory domain) internal pure returns(bool) {
        return domain.withdrawInitiated == 0;
    }

    function canTransfer(Domain memory domain) internal view returns(bool) {
        return isNotWithdrawing(domain)
            && isNotCustodianLocked(domain)
            && isNotExpired(domain)
            && isNotLocked(domain);
    }
    function updateExpiry(Domain storage domain, uint256 expiryTime) internal {
        domain.expiryTime = expiryTime;
    }
    function setLock(Domain storage domain, bool status) internal {
        if(status){
            domain.lockTime = block.timestamp;
        } else {
            domain.lockTime = 0;
        }
    }

    function setWithdraw(Domain storage domain, bool status) internal {
        if(status){
            domain.withdrawInitiated = block.timestamp;
        } else {
            domain.withdrawInitiated = 0;
        }
    }
    
    function setCustodianLock(Domain storage domain, bool status) internal {
        if(status){
            domain.custodianLock = block.timestamp;
        } else {
            domain.custodianLock = 0;
        }
    }
    
}
