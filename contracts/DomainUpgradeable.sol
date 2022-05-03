// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {Destroyable} from "./Destroyable.sol";

contract DomainUpgradeable is TransparentUpgradeableProxy, Destroyable {
 constructor(
  address _logic,
  address _admin,
  bytes memory _data
 ) TransparentUpgradeableProxy(_logic, _admin, _data) {}
}
