const hre = require('hardhat');
const fs = require('fs');
const deploy = require('./deployers');
const config = require('../config');

const { ethers } = hre;

const displayDeploymentInfo = (deployment, name) => {
  const implementationOutput = deployment.implementation
    ? `having implementation @ ${deployment.implementation.contract.address} and salt ${deployment.implementation.salt}`
    : '';

  console.log(`${name} deployed @ ${deployment.contract.address} and salt ${deployment.salt} ${implementationOutput}`);
  console.log(`${name} deployed
@ ${deployment.contract.address}
and salt ${deployment.salt}
${implementationOutput}`);

  fs.writeFileSync(`./deploys/${config.get('network.name')}/${name}.address`, deployment.contract.address);
  fs.writeFileSync(`./deploys/${config.get('network.name')}/${name}.salt`, deployment.salt);
  fs.writeFileSync(`./deploys/${config.get('network.name')}/${name}.implementation.address`, deployment.implementation.contract.address);
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
  let custodian;
  if (fs.existsSync(`./deploys/${config.get('network.name')}/custodian.address`, 'utf8')) {
    custodian = {};
    custodian.address = fs.readFileSync(`./deploys/${config.get('network.name')}/custodian.address`, 'utf8').toString();
    custodian.salt = fs.readFileSync(`./deploys/${config.get('network.name')}/custodian.salt`, 'utf8').toString();
    const custodianArtifact = await hre.artifacts.readArtifact('CustodianImplementationV2');
    custodian.contract = new ethers.Contract(custodian.address, custodianArtifact.abi, owner);
    custodian.implementation = {};
    custodian.implementation.address = fs.readFileSync(`./deploys/${config.get('network.name')}/custodian.implementation.address`, 'utf8').toString();
    custodian.implementation.contract = new ethers.Contract(custodian.implementation.address, custodianArtifact.abi, owner);
  } else {
    custodian = await deploy.upgradeable({
      name: 'custodian',
      deployer,
      admin: admin.contract,
      owner,
      specificSalt: ethers.utils.id('dnt-custodian'),
      artifactName: 'CustodianImplementationV2',
      initFunction: 'initialize(string,string)',
      initArgs: [config.get('custodian.name'), config.get('custodian.url')],
    });
    displayDeploymentInfo(custodian, 'custodian');
  }

  displayDeploymentInfo(custodian, 'custodian');

  const domain = await deploy.upgradeable({
    name: 'domain',
    deployer,
    admin: admin.contract,
    owner,
    specificSalt: ethers.utils.id('dnt-domain'),
    artifactName: 'DomainImplementationV2',
    initFunction: 'initialize(address,string,string,string,string)',
    initArgs: [custodian.contract.address, config.get('domain.symbol'), config.get('domain.name'), ' ', '-'],
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
