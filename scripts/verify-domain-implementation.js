const hre = require('hardhat');

const { ethers } = hre;
const fs = require('fs');
const config = require('../config');

async function main(version) {
  if (!version) {
    throw new Error('version is required');
  }

  const [owner] = await ethers.getSigners();
  console.log(`Verifying domain implementation on ${config.get('network.name')} network`);

  const domainImplementationAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/domain.implementation-${version}.address`).toString();

  try {
    await hre.run('verify:verify', {
      address: domainImplementationAddress,
      constructorArguments: [],
      contract: 'contracts/DomainImplementation.sol:DomainImplementation',
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main(process.argv[2]).then(() => {
  console.log('DONE');
}).catch(console.error);
