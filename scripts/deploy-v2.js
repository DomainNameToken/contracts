const hre = require('hardhat');
const deploy = require('./deployers');
const config = require('../config');

const { ethers } = hre;

const displayDeploymentInfo = (deployment, name) => {
  const implementationOutput = deployment.implementation
    ? `having implementation @ ${deployment.implementation.contract.address} and salt ${deployment.implementation.salt}`
    : '';

  console.log(`${name} deployed @ ${deployment.contract.address} and salt ${deployment.salt} ${implementationOutput}`);
};

async function main() {
  await hre.run('compile');
  const [owner] = await ethers.getSigners();

  /*
TODO
- deployer
- admin
- custodian
- domain
- AcquisitionManaager
  */

  const deployer = await deploy.deployer(owner);

  const admin = await deploy.admin({ owner, deployer });

  const custodian = await deploy.upgradeable({
    deployer,
    admin: admin.contract,
    owner,
    specificSalt: ethers.utils.id('dnt-custodian'),
    artifactName: 'CustodianImplementationV2',
    initFunction: 'initialize(string,string)',
    initArgs: ['DNT', 'https://dnt.network/token/json/'],
  });

  displayDeploymentInfo(custodian, 'custodian');

  const domain = await deploy.upgradeable({
    deployer,
    admin: admin.contract,
    owner,
    specificSalt: ethers.utils.id('dnt-domain'),
    artifactName: 'DomainImplementationV2',
    initFunction: 'initialize(address,string,string)',
    initArgs: [custodian.contract.address, 'DOMAIN', 'Domains'],
  });

  displayDeploymentInfo(domain, 'domain');

  const acquisitionManager = await deploy.upgradeable({
    deployer,
    admin: admin.contract,
    owner,
    specificSalt: ethers.utils.id('dnt-acquisition-manager'),
    artifactName: 'AcquisitionManagerImplementationV2',
    initFunction: 'initialize(address)',
    initArgs: [custodian.contract.address],
  });

  displayDeploymentInfo(acquisitionManager, 'AcquisitionManager');
}

main().then(() => {
  console.log('MIGRATIONS DONE');
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
