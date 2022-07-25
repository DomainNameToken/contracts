// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockChainlinkAggregator {
  uint8 _decimals;
  uint256 _lastPrice;

  constructor(uint8 decimals_, uint256 lastPrice_) {
    _decimals = decimals_;
    _lastPrice = lastPrice_;
  }

  function decimals() external view returns (uint8) {
    return _decimals;
  }

  function latestRoundData()
    external
    view
    returns (
      uint80,
      int256,
      uint256,
      uint256,
      uint80
    )
  {
    return (0, int256(_lastPrice), 0, 0, 0);
  }

  function setDecimals(uint8 decimals_) external {
    _decimals = decimals_;
  }

  function setPrice(uint256 price) external {
    _lastPrice = price;
  }
}
