const hre = require('hardhat');
const fs = require('fs');
const deploy = require('./deployers');

const { ethers } = hre;

const config = require('../config');

const version = process.argv[2] || `next-${Date.now()}`;

async function main() {
  await hre.run('compile');
  const [owner, operator1, operator2] = await ethers.getSigners();

  console.log('Deploying deployer');
  const deployer = await deploy.deployer(owner);
  console.log('Deploying admin');
  const admin = await deploy.admin({ owner, deployer });

  const upgradeableAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/custodian.address`).toString();
  const artifact = await hre.artifacts.readArtifact('CustodianImplementationV2');
  console.log('deploying Custodian Implementation');
  const upImplementation = await deploy.vanity({
    deployer,
    owner,
    specificSalt: ethers.utils.id(`dnt-custodian-${version}`),
    artifact,
    constructorBytes: undefined,
  });
  console.log(`Deployed Custodian Implementation at ${upImplementation.address}`);
  fs.writeFileSync(
    `./deploys/${config.get('network.name')}/custodian.implementation-${version}.address`,
    `${upImplementation.address}`,
  );
  const tx = await admin.contract.upgrade(
    upgradeableAddress,
    upImplementation.address,
    { gasLimit: 5000000 },
  );
  console.log(`upgrade tx: ${tx.hash}`);
  await tx.wait();
  console.log('upgrade tx mined');
}

main().then(() => {
  console.log('DONE');
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
