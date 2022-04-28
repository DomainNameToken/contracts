// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Domains } from '../libraries/Domain.sol';

interface IDomainTokenBase {

    event DomainBurned(uint256 chainId, uint256 tokenId, uint256 sourceChainId, uint256 destinationChainId, address sourceOwner, address destinationOwner, string domainName);
    event DomainMinted(uint256 chainId, uint256 tokenId, uint256 sourceChainId, uint256 destinationChainId, address sourceOwner, address destinationOwner, string domainName);
    function getTokenIdByName(string memory) external view returns(uint256);
    function getDomainInfo(uint256) external view returns(Domains.Domain memory);
    function fulfillWithdraw(uint256) external;
    function cancelWithdrawRequest(uint256) external;
    function requestWithdraw(uint256) external;
    function setCustodianLock(uint256, bool) external;
    function setLock(uint256, bool) external;
    function setCustodian(address) external;
}
