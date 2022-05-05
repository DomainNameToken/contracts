// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library BytesDecoder {
  function toBytes(bytes memory b) internal pure returns (bytes memory) {
    return abi.decode(b, (bytes));
  }

  function toUint256(bytes memory b) internal pure returns (uint256) {
    return abi.decode(b, (uint256));
  }

  function toBool(bytes memory b) internal pure returns (bool) {
    return abi.decode(b, (bool));
  }

  function toAddress(bytes memory b) internal pure returns (address) {
    return abi.decode(b, (address));
  }

  function toString(bytes memory b) internal pure returns (string memory) {
    return abi.decode(b, (string));
  }

  function extractRevertReason(bytes memory revertData)
    internal
    pure
    returns (string memory reason)
  {
    uint256 l = revertData.length;
    if (l < 68) return "";
    uint256 t;
    assembly {
      revertData := add(revertData, 4)
      t := mload(revertData) // Save the content of the length slot
      mstore(revertData, sub(l, 4)) // Set proper length
    }
    reason = abi.decode(revertData, (string));
    assembly {
      mstore(revertData, t) // Restore the content of the length slot
    }
  }
}
