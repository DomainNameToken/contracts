const hre = require('hardhat');

const { ethers } = hre;
const fs = require('fs');
const config = require('../config');

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Verifying contracts on ${config.get('network.name')} network`);
  // verify deployer
  const deployerAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/deployer.address`).toString();

  await hre.run('verify', {
    address: deployerAddress,
    constructorArguments: [],
    contract: 'contracts/Deployer.sol:Deployer',
  });

  const adminAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/admin.address`).toString();

  await hre.run('verify', {
    address: adminAddress,
    constructorArguments: [],
    contract: 'contracts/AdminProxy.sol:AdminProxy',
  });

  const custodianImplementationAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/custodian.implementation.address`).toString();
  await hre.run('verify', {
    address: custodianImplementationAddress,
    constructorArguments: [],
    contract: 'contracts/CustodianImplementation.sol:CustodianImplementation',
  });

  const custodianAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/custodian.address`).toString();

  const custodianImplementationArtifact = await hre.artifacts.readArtifact('CustodianImplementation');
  const custodianImplementation = new ethers.Contract(custodianImplementationAddress, custodianImplementationArtifact.abi, owner);
  const custodianInitBytes = custodianImplementation.interface.encodeFunctionData('initialize(string,string)', [config.get('custodian.name'), config.get('custodian.url')]);
  await hre.run('verify', {
    address: custodianAddress,
    constructorArguments: [custodianImplementationAddress, adminAddress, custodianInitBytes],
    contract: 'contracts/UpgradeableContract.sol:UpgradeableContract',
  });

  const domainImplementationAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/domain.implementation.address`).toString();
  await hre.run('verify', {
    address: domainImplementationAddress,
    constructorArguments: [],
    contract: 'contracts/DomainImplementation.sol:DomainImplementation',
  });
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
  await hre.run('verify', {
    address: domainAddress,
    constructorArguments: [domainImplementationAddress, adminAddress, domainInitBytes],
    contract: 'contracts/UpgradeableContract.sol:UpgradeableContract',
  });

  const acquisitionManagerImplementationAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/AcquisitionManager.implementation.address`).toString();
  await hre.run('verify', {
    address: acquisitionManagerImplementationAddress,
    constructorArguments: [],
    contract: 'contracts/AcquisitionManagerImplementation.sol:AcquisitionManagerImplementation',
  });
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
  await hre.run('verify', {
    address: acquisitionManagerAddress,
    constructorArguments: [acquisitionManagerImplementationAddress, adminAddress, acquisitionManagerInitBytes],
    contract: 'contracts/UpgradeableContract.sol:UpgradeableContract',
  });
}

main().then(() => {
  console.log('DONE');
}).catch(console.error);
