const common = require('./common');
const deployer = require('./deployer');
const waiter = require('./waiter');

const doAtGasPrice = async (toBeDone, maxGasPrice) => {
  await waiter.waitForGasFee(maxGasPrice);
  const result = await toBeDone();
  return result;
};

module.exports = {
  ...common,
  deployer,
  waiter,
  doAtGasPrice,
};
