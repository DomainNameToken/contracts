const hre = require('hardhat');

class Waiter {
  constructor() {
    this.isWaiting = false;
    this.waitDescription = '';
    this.blocksWaited = 0;
    this.sleeper = null;
    this.sleepForBlocks = 0;
    this.sleepedBlocks = 0;
    this.displayMessage = '';
    this.waitForGoodBlock = false;
    this.waitForBlockWithMaxFeeOf = hre.ethers.utils.parseUnits('30', 'gwei');
    hre.ethers.provider.on('block', this.onBlock.bind(this));
  }

  async onBlock(blockNumber) {
    if (!this.waitForGoodBlock) {
      if (this.isWaiting) {
        this.blocksWaited += 1;
        console.log(`${this.waitDescription} waited ${this.blocksWaited} blocks`);
      }
      if (this.sleeper) {
        this.sleepedBlocks += 1;
        console.log(`sleeping blocks (${this.sleepedBlocks}) out of ${this.sleepForBlocks}`);
        if (this.sleepedBlocks >= this.sleepForBlocks) {
          this.sleeper();
          this.sleeper = null;
          this.sleepedBlocks = 0;
          this.sleepForBlocks = 0;
        }
      }
    } else {
      const block = await hre.ethers.provider.getBlock(blockNumber);
      const {
        number, gasLimit, gasUsed, baseFeePerGas,
      } = block;
      const p = gasUsed.mul(10000).div(gasLimit);
      const pn = parseInt(`${p}`, 10);
      const pp = pn / 100;
      const gwei = parseFloat(`${hre.ethers.utils.formatUnits(baseFeePerGas, 'gwei')}`);

      let beep = 'waiting';
      if (this.waitForBlockWithMaxFeeOf.gte(baseFeePerGas) && pp < 50) {
        this.waitForGoodBlock = false;

        beep = '\x07';
        console.log(`${beep} ${hre.network.name} ${number} : GL: ${gasLimit.toString()} GU: ${gasUsed.toString()} P: ${pp}% BFPG: ${gwei} T: ${hre.ethers.utils.formatUnits(this.waitForBlockWithMaxFeeOf, 'gwei')}`);

        this.sleeper();
        this.sleeper = null;
      } else {
        console.log(`${beep} ${hre.network.name} ${number} : GL: ${gasLimit.toString()} GU: ${gasUsed.toString()} P: ${pp}% BFPG: ${gwei} T: ${hre.ethers.utils.formatUnits(this.waitForBlockWithMaxFeeOf, 'gwei')}`);
      }
    }
  }

  async wait(description, waitForTx) {
    this.waitDescription = description;
    this.isWaiting = true;
    console.log(`${waitForTx ? waitForTx.hash : ''}`);
    const r = await waitForTx;
    this.isWaiting = false;

    console.log(`${description} waited for ${this.blocksWaited} blocks`);
    this.blocksWaited = 0;
    return r;
  }

  sleep(blocks) {
    return new Promise((resolve) => {
      this.sleepForBlocks = blocks;
      this.sleepedBlocks = 0;
      this.sleeper = resolve;
    });
  }

  waitForGasFee(maxGasFee) {
    return new Promise((resolve) => {
      this.sleeper = resolve;
      this.waitForGoodBlock = true;
      this.waitForBlockWithMaxFeeOf = maxGasFee;
    });
  }
}

module.exports = new Waiter();
