# @DomainNameToken/contracts

Contracts used by [Domain Name Token](https://dnt.network/) to identify Top-Level Domain names on blockchain.

All contracts follow [ERC1967Proxy](https://eips.ethereum.org/EIPS/eip-1967) upgradeable pattern.


## Domain Token

Contract that follows [ERC721](https://ethereum.org/en/developers/docs/standards/tokens/erc-721/) standard. Each token identifies a domain name in custody of [Domain Name Token](https://dnt.network/).

All domain names are identified by their own token ID that is created from `uint256(keccak256(abi.encode(domainName)))`


## Acquisition Manager

Acquisition management contract. Contains prices for each accepted TLDs, list of accepted stablecoins for order payments and accepts acquisition orders requests for registering, extending and imports of domain names.

## Custodian

It has a list of trusted operators that are allowed to call administrative methods of Domain Token and Acquisition Manager contracts.


---
