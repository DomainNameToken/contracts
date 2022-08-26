const hre = require('hardhat');

const { ethers } = hre;
const fs = require('fs');
const config = require('../config');

async function main() {
  const [owner, operator] = await ethers.getSigners();
  const acquisitionManagerAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/AcquisitionManager.address`, 'utf8');
  const artifact = await hre.artifacts.readArtifact('AcquisitionManagerImplementation');
  const contract = new ethers.Contract(acquisitionManagerAddress, artifact.abi, owner);

  const tx = await contract.setConfigs(
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    config.get('acquisitionManager.nativePriceRoundingDecimals'),
    config.get('acquisitionManager.standardPriceDecimals'),
  );
  console.log(`setting configs ${tx.hash}`);
  await tx.wait();
  console.log('configs set successfully');
}

main().then(() => {
  console.log('MIGRATION DONE');
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
