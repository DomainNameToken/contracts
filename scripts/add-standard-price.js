const hre = require('hardhat');
const fs = require('fs');

const { ethers } = hre;
const tlds = require('../data/tlds-am');
const config = require('../config');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function main() {
  const [owner] = await ethers.getSigners();

  const custodianArtifact = await hre.artifacts.readArtifact('CustodianImplementation');
  const acquisitionManagerArtifact = await hre.artifacts.readArtifact('AcquisitionManagerImplementation');
  const custodianAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/custodian.address`).toString();
  const acquisitionManagerAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/AcquisitionManager.address`).toString();
  const contracts = {};
  contracts.custodian = new ethers.Contract(custodianAddress, custodianArtifact.abi, owner);
  contracts.acquisitionManager = new ethers.Contract(acquisitionManagerAddress, acquisitionManagerArtifact.abi, owner);

  let enabledTlds = [];
  let enabledTldsWithPrices = [];
  let tx;
  let nonce = await ethers.provider.getTransactionCount(owner.address);
  console.log(`starting nonce ${nonce}`);
  for (let i = 0; i < tlds.length; i++) {
    enabledTlds.push(tlds[i].tld);
    tlds[i].price = Math.ceil((tlds[i].price) * 100) / 100;

    enabledTldsWithPrices.push(ethers.utils.parseUnits(
      `${tlds[i].price}`,
      parseInt(config.get('acquisitionManager.standardPriceDecimals')),
    ));
    if (enabledTlds.length > 10) {
      console.log(`enabling ${enabledTlds.join(',')} tlds on custodian`);
      console.log(`using nonce ${nonce}`);
      tx = await contracts.custodian.enableTlds(enabledTlds, {
        gasLimit: 5000000,
        nonce,
        gasPrice: ethers.utils.parseUnits('250', 'gwei'),
      });
      console.log(`enabling ${enabledTlds.join(',')} tlds ${tx.hash}`);
      await tx.wait();

      nonce++;
      await sleep(1000);
      console.log(`adding standard prices for ${enabledTlds.join(',')} tlds on acquisition manager`);
      console.log(`using nonce ${nonce}`);
      tx = await contracts.acquisitionManager.setStandardPrice(enabledTlds, enabledTldsWithPrices, {
        gasLimit: 5000000,
        gasPrice: ethers.utils.parseUnits('250', 'gwei'),
        nonce,
      });
      nonce++;
      console.log(`adding standard prices for ${enabledTlds.join(',')} tlds with prices ${enabledTldsWithPrices.join(' , ')}
       ${tx.hash}`);
      await tx.wait();
      enabledTlds = [];
      enabledTldsWithPrices = [];
      await sleep(1000);
    }
  }
  if (enabledTlds.length > 0) {
    console.log(`using nonce ${nonce}`);
    console.log(`enabling ${enabledTlds.join(',')} tlds on custodian`);
    tx = await contracts.custodian.enableTlds(enabledTlds, {
      gasLimit: 5000000,
      nonce,
      gasPrice: ethers.utils.parseUnits('250', 'gwei'),
    });
    console.log(`enabling ${enabledTlds.join(',')} tlds ${tx.hash}`);
    await tx.wait();
    nonce++;
    await sleep(1000);
    console.log(`adding standard prices for ${enabledTlds.join(',')} tlds on acquisition manager`);
    console.log(`using nonce ${nonce}`);
    tx = await contracts.acquisitionManager.setStandardPrice(enabledTlds, enabledTldsWithPrices, { gasLimit: 5000000, gasPrice: ethers.utils.parseUnits('250', 'gwei'), nonce });
    console.log(`adding standard prices for ${enabledTlds.join(',')} tlds with prices ${enabledTldsWithPrices.join(' , ')}
 ${tx.hash}`);
    await tx.wait();
    enabledTlds = [];
  }
}

main().then(() => {
  console.log('DONE');
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
