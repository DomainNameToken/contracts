const hre = require('hardhat');

const fs = require('fs');

const config = require('../../config');

const { ethers } = hre;

const sleep = (interval) => new Promise((resolve) => {
  setTimeout(resolve, interval);
});

module.exports = async function main(owner, compile = false) {
  if (compile) {
    await hre.run('compile');
  }

  const deployerAddressPath = `./deploys/${config.get('network.name')}/deployer.address`;
  if (fs.existsSync(deployerAddressPath)) {
    // throw new Error(`Deployer address already exists for ${config.get('network.name')} @ ${deployedAddressPath}`);
    const artifact = await hre.artifacts.readArtifact('Deployer');
    const deployerAddress = fs.readFileSync(deployerAddressPath).toString();
    const deployer = new ethers.Contract(deployerAddress, artifact.abi, owner);
    return deployer;
  }
  const Deployer = await ethers.getContractFactory('Deployer');

  const deployer = await Deployer.deploy();
  console.log(`deployer deployed @ ${deployer.address}`);
  fs.writeFileSync(deployerAddressPath, `${deployer.address}`);
  return deployer;
};
