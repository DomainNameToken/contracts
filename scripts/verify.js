const hre = require('hardhat');

const { ethers } = hre;
const fs = require('fs');
const config = require('../config');

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Verifying contracts on ${config.get('network.name')} network`);
  // verify deployer
  const deployerAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/deployer.address`).toString();
  try {
    await hre.run('verify:verify', {
      address: deployerAddress,
      constructorArguments: [],
      contract: 'contracts/Deployer.sol:Deployer',
    });
  } catch (e) {

  }

  const adminAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/admin.address`).toString();
  try {
    await hre.run('verify:verify', {
      address: adminAddress,
      constructorArguments: [],
      contract: 'contracts/AdminProxy.sol:AdminProxy',
    });
  } catch (e) {
  }

  const custodianImplementationAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/custodian.implementation.address`).toString();
  try {
    await hre.run('verify:verify', {
      address: custodianImplementationAddress,
      constructorArguments: [],
      contract: 'contracts/CustodianImplementation.sol:CustodianImplementation',
    });
  } catch (e) {

  }

  const custodianAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/custodian.address`).toString();

  const custodianImplementationArtifact = await hre.artifacts.readArtifact('CustodianImplementation');
  const custodianImplementation = new ethers.Contract(custodianImplementationAddress, custodianImplementationArtifact.abi, owner);
  const custodianInitBytes = custodianImplementation.interface.encodeFunctionData('initialize(string,string)', [config.get('custodian.name'), config.get('custodian.url')]);
  console.log(`verifying custodian upgradeable contract ${custodianAddress}`);
  console.log(
    'arguments:',
    [custodianImplementationAddress, adminAddress, custodianInitBytes],
  );
  try {
    await hre.run('verify:verify', {
      address: custodianAddress,
      constructorArguments: [
        custodianImplementationAddress, adminAddress, custodianInitBytes,
      ],
      contract: 'contracts/UpgradeableContract.sol:UpgradeableContract',
    });
  } catch (e) {
  }

  const domainImplementationAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/domain.implementation.address`).toString();
  try {
    await hre.run('verify:verify', {
      address: domainImplementationAddress,
      constructorArguments: [],
      contract: 'contracts/DomainImplementation.sol:DomainImplementation',
    });
  } catch (e) {
  }
  const domainImplementationArtifact = await hre.artifacts.readArtifact('DomainImplementation');
  const domainImplementation = new ethers.Contract(domainImplementationAddress, domainImplementationArtifact.abi, owner);
  const domainInitBytes = domainImplementation.interface
    .encodeFunctionData(
      'initialize(address,string,string,string,string)',
      [custodianAddress,
        config.get('domain.symbol'),
        config.get('domain.name'),
        config.get('domain.nameSeparator'),
        config.get('domain.symbolSeparator')],
    );
  const domainAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/domain.address`).toString();
  try {
    await hre.run('verify:verify', {
      address: domainAddress,
      constructorArguments: [domainImplementationAddress, adminAddress, domainInitBytes],
      contract: 'contracts/UpgradeableContract.sol:UpgradeableContract',
    });
  } catch (e) {
  }
  console.log('verifying acquisition manager implementation');
  const acquisitionManagerImplementationAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/AcquisitionManager.implementation.address`).toString();
  try {
    await hre.run('verify:verify', {
      address: acquisitionManagerImplementationAddress,
      constructorArguments: [],
      contract: 'contracts/AcquisitionManagerImplementation.sol:AcquisitionManagerImplementation',
    });
  } catch (e) {
    console.log(e);
  }
  const acquisitionManagerImplementationArtifact = await hre.artifacts.readArtifact('AcquisitionManagerImplementation');
  const acquisitionManagerImplementation = new ethers.Contract(acquisitionManagerImplementationAddress, acquisitionManagerImplementationArtifact.abi, owner);
  const acquisitionManagerInitBytes = acquisitionManagerImplementation.interface
    .encodeFunctionData(
      'initialize(address,address,address,uint256,uint256)',
      [
        custodianAddress,
        domainAddress,
        config.get('acquisitionManager.chainlinkAggregator'),
        config.get('acquisitionManager.nativePriceRoundingDecimals'),
        config.get('acquisitionManager.standardPriceDecimals'),
      ],
    );

  const acquisitionManagerAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/AcquisitionManager.address`).toString();
  console.log('verifying acquisition manager upgradeable');
  try {
    await hre.run('verify:verify', {
      address: acquisitionManagerAddress,
      constructorArguments: [acquisitionManagerImplementationAddress, adminAddress, acquisitionManagerInitBytes],
      contract: 'contracts/UpgradeableContract.sol:UpgradeableContract',
    });
  } catch (e) {
    console.log(e);
  }
}

main().then(() => {
  console.log('DONE');
}).catch(console.error);
