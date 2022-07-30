const hre = require('hardhat');

const { ethers } = hre;
const fs = require('fs');
const config = require('../config');

async function main() {
  console.log(`setting stable token on ${config.get('network.name')}`);
  const [owner, operator] = await ethers.getSigners();
  const acquisitionManagerAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/AcquisitionManager.address`, 'utf8');
  const artifact = await hre.artifacts.readArtifact('AcquisitionManagerImplementationV2');
  const contract = new ethers.Contract(acquisitionManagerAddress, artifact.abi, owner);

  const tx = await contract.addStableToken(config.get('acquisitionManager.stableTokenAddress'));
  console.log(`${tx.hash}`);
  await tx.wait();
  console.log(`done ${tx.hash}`);
}

main().then(() => {
  console.log('MIGRATION DONE');
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
