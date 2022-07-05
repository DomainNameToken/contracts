const hre = require('hardhat');

const { ethers } = hre;
const fs = require('fs');
const config = require('../config');

async function main() {
  console.log(`setting operators on ${config.get('network.name')}`);
  const [owner, operator] = await ethers.getSigners();
  const custodianAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/custodian.address`, 'utf8');
  const artifact = await hre.artifacts.readArtifact('CustodianImplementationV2');
  const custodian = new ethers.Contract(custodianAddress, artifact.abi, owner);
  let isOperator = await custodian.isOperator(owner.address);
  if (!isOperator) {
    console.log(`adding ${owner.address} as custodian operator`);
    await custodian.addOperator(owner.address);
  }
  isOperator = await custodian.isOperator(operator.address);
  if (!isOperator) {
    console.log(`adding ${operator.address} as custodian operator`);
    await custodian.addOperator(operator.address);
  }
}

main().then(() => {
  console.log('MIGRATION DONE');
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
