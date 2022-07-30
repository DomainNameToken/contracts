const { ethers } = require('ethers');

function encodeFunction(contract, method, args) {
  return contract.interface.encodeFunctionData(method, args);
}

function encode(types, values) {
  return ethers.utils.defaultAbiCoder
    .encode(
      types,
      values,
    );
}

function decode(types, data) {
  return ethers.utils.defaultAbiCoder.decode(types, data);
}

function anInstruction({
  type = 0,
  value = 0,
  contract,
  method,
  version = 1,
  methodDesc = null,
  args,
  next = [],
}) {
  return encode(
    ['uint256', 'uint256', 'address', 'string', 'uint256', 'bytes', 'bytes'],
    [
      type,
      value,
      contract.address,
      methodDesc || method,
      version,
      encodeFunction(contract, method, args),
      next,
    ],
  );
}

class Core {
  constructor({
    abis, defisList, modulesList, encodingsMap,
  }) {
    this.contracts = {};
    this.abis = abis;
    this.defisList = defisList;
    this.modulesList = modulesList;
    this.encodingsMap = encodingsMap;
    this.encodings = {};
  }

  init({ addresses, owner }) {
    this.owner = owner;
    this.contracts.executor = new ethers.Contract(addresses.executor, this.abis.executor, this.owner);
    this.contracts.modules = {};
    this.encodings.modules = {};
    for (let i = 0; i < this.modulesList.length; i++) {
      const module = this.modulesList[i];
      this.contracts.modules[module] = new ethers.Contract(addresses.modules[module], this.abis.modules[module], this.owner);
      this.encodings.modules[module] = this.encodingsMap.modules[module];
    }
    this.contracts.defis = {};
    this.encodings.defis = {};
    for (let i = 0; i < this.defisList.length; i++) {
      const defi = this.defisList[i];
      this.contracts.defis[defi] = new ethers.Contract(addresses.defis[defi], this.abis.defis[defi], this.owner);
      this.encodings.defis[defi] = this.encodingsMap.defis[defi];
    }
  }

  constant(encodeType, value, next = undefined) {
    return anInstruction({
      contract: this.modules.constant,
      method: 'value(bytes)',
      args: [encode([encodeType], [value])],
      next,
    });
  }

  toInstruction(type, method, args) {

  }
}

module.exports = {
  Core,
};
