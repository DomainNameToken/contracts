const hre = require('hardhat');
const fs = require('fs');

const { ethers } = hre;
const tlds = require('../data/tlds-am');
const config = require('../config');

async function main(tldsToDisable) {
  const [owner] = await ethers.getSigners();

  const custodianArtifact = await hre.artifacts.readArtifact('CustodianImplementation');
  const acquisitionManagerArtifact = await hre.artifacts.readArtifact('AcquisitionManagerImplementation');
  const custodianAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/custodian.address`).toString();
  const acquisitionManagerAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/AcquisitionManager.address`).toString();
  const contracts = {};
  contracts.custodian = new ethers.Contract(custodianAddress, custodianArtifact.abi, owner);
  contracts.acquisitionManager = new ethers.Contract(acquisitionManagerAddress, acquisitionManagerArtifact.abi, owner);

  const disabledTlds = [...tldsToDisable];
  const disabledTldsWithPrices = [tldsToDisable.map(() => 0)];

  console.log(`disabling tlds on custodian: ${disabledTlds.join(',')}`);
  let tx = await contracts.custodian.disableTlds(disabledTlds, { gasLimit: 5000000 });
  console.log(`${tx.hash} ...`);
  await tx.wait();
  console.log(`disabling tlds on acquisitionManager: ${disabledTlds.join(',')}`);
  tx = await contracts.acquisitionManager.setStandardPrice(disabledTlds, disabledTldsWithPrices, { gasLimit: 5000000 });
  console.log(`${tx.hash} ...`);
  await tx.wait();
}

main(process.argv.slice(2)).then(() => {
  console.log('DONE');
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
