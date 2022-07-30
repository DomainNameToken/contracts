const hre = require('hardhat');
const fs = require('fs');
const deploy = require('./deployers');
const config = require('../config');
const tlds = require('../data/tlds');

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
  const [owner, operator1, operator2] = await ethers.getSigners();

  /*
TODO
- deployer
- admin
- custodian
- domain
- AcquisitionManaager
  */
  console.log('Deploying deployer');
  const deployer = await deploy.deployer(owner);
  console.log('Deploying admin');
  const admin = await deploy.admin({ owner, deployer });
  console.log('Deploying custodian');
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
  console.log('Deploying domain');
  const domain = await deploy.upgradeable({
    name: 'domain',
    deployer,
    admin: admin.contract,
    owner,
    specificSalt: ethers.utils.id('dnt-domain'),
    artifactName: 'DomainImplementationV2',
    initFunction: 'initialize(address,string,string,string,string)',
    initArgs: [custodian.contract.address, config.get('domain.symbol'), config.get('domain.name'), config.get('domain.nameSeparator'), config.get('domain.symbolSeparator')],
  });

  displayDeploymentInfo(domain, 'domain');
  console.log('Deploying acquisition manager');
  const acquisitionManager = await deploy.upgradeable({
    deployer,
    admin: admin.contract,
    owner,
    specificSalt: ethers.utils.id('dnt-acquisition-manager'),
    artifactName: 'AcquisitionManagerImplementationV2',
    initFunction: 'initialize(address,address,address,uint256,uint256)',
    initArgs: [custodian.contract.address,
      domain.contract.address,
      config.get('acquisitionManager.chainlinkAggregator'),
      config.get('acquisitionManager.nativePriceRoundingDecimals'),
      config.get('acquisitionManager.standardPriceDecimals')],
  });
  displayDeploymentInfo(acquisitionManager, 'AcquisitionManager');
  let stableAddress = config.get('acquisitionManager.stableTokenAddress');
  if (config.get('acquisitionManager.stableTokenAddress') == '') {
    // TODO: deploy stable token
    console.log('Deploying stable token');
    const Stable = await ethers.getContractFactory('MockERC20Token');
    const stable = await Stable.deploy('MUSD', 'MUSD', 6);
    stableAddress = stable.address;
    console.log(`stable token address: ${stableAddress}`);
  }
  const artifacts = {};
  artifacts.custodian = await hre.artifacts.readArtifact('CustodianImplementationV2');
  artifacts.domain = await hre.artifacts.readArtifact('DomainImplementationV2');
  artifacts.acquisitionManager = await hre.artifacts.readArtifact('AcquisitionManagerImplementationV2');
  const contracts = {};
  contracts.custodian = new ethers.Contract(custodian.contract.address, artifacts.custodian.abi, owner);
  contracts.domain = new ethers.Contract(domain.contract.address, artifacts.domain.abi, owner);
  contracts.acquisitionManager = new ethers.Contract(acquisitionManager.contract.address, artifacts.acquisitionManager.abi, owner);
  console.log(`adding opoerator ${owner.address}`);
  await contracts.custodian.addOperator(owner.address);
  console.log(`adding opoerator ${operator1.address}`);
  await contracts.custodian.addOperator(operator1.address);
  console.log(`adding opoerator ${operator2.address}`);
  await contracts.custodian.addOperator(operator2.address);
  let enabledTlds = [];
  let enabledTldsWithPrices = [];
  for (let i = 0; i < tlds.length; i++) {
    enabledTlds.push(tlds[i].tld);
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
  console.log(`adding stableToken ${stableAddress} to acquisition manager`);
  await contracts.acqusitionManager.addStableToken(stableAddress);
}

main().then(() => {
  console.log('MIGRATIONS DONE');
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
