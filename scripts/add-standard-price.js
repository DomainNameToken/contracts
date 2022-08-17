const hre = require('hardhat');
const fs = require('fs');

const { ethers } = hre;
const tlds = require('../data/tlds');
const config = require('../config');

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
  for (let i = 0; i < tlds.length; i++) {
    enabledTlds.push(tlds[i].tld);
    tlds[i].price = Math.ceil((tlds[i].price + 8) * 100) / 100;

    enabledTldsWithPrices.push(ethers.utils.parseUnits(
      `${tlds[i].price}`,
      parseInt(config.get('acquisitionManager.standardPriceDecimals')),
    ));
    if (enabledTlds.length > 10) {
      console.log(`enabling ${enabledTlds.join(',')} tlds on custodian`);
      await contracts.custodian.enableTlds(enabledTlds, { gasLimit: 5000000 });
      console.log(`adding standard prices for ${enabledTlds.join(',')} tlds on acquisition manager`);
      await contracts.acquisitionManager.setStandardPrice(enabledTlds, enabledTldsWithPrices, { gasLimit: 5000000 });
      enabledTlds = [];
      enabledTldsWithPrices = [];
    }
  }
  if (enabledTlds.length > 0) {
    console.log(`enabling ${enabledTlds.join(',')} tlds on custodian`);
    await contracts.custodian.enableTlds(enabledTlds, { gasLimit: 5000000 });
    console.log(`adding standard prices for ${enabledTlds.join(',')} tlds on acquisition manager`);
    await contracts.acquisitionManager.setStandardPrice(enabledTlds, enabledTldsWithPrices, { gasLimit: 5000000 });
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
