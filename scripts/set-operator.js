const hre = require('hardhat');

const { ethers } = hre;
const fs = require('fs');
const config = require('../config');

async function main() {
  console.log(`setting operators on ${config.get('network.name')}`);
  const [owner, operator1, operator2] = await ethers.getSigners();
  const custodianAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/custodian.address`, 'utf8');
  const artifact = await hre.artifacts.readArtifact('CustodianImplementation');
  const custodian = new ethers.Contract(custodianAddress, artifact.abi, owner);
  const operators = [owner, operator1, operator2];
  for (let i = 0; operators.length > i; i++) {
    const operator = operators[i];
    const isOperator = await custodian.isOperator(operator.address);
    if (!isOperator) {
      console.log(`adding ${operator.address} as custodian operator`);
      await custodian.addOperator(owner.address);
    }
  }
}

main().then(() => {
  console.log('MIGRATION DONE');
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
