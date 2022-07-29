const hre = require('hardhat');

const { ethers } = hre;
const fs = require('fs');
const config = require('../config');

async function main(pgpPubKeyPath) {
  if (!fs.existsSync(pgpPubKeyPath)) {
    throw new Error(`PGP public key file ${pgpPubKeyPath} does not exist`);
  }
  const pgpPubKey = fs.readFileSync(pgpPubKeyPath, 'utf8').toString();

  const [owner, operator] = await ethers.getSigners();
  const address = fs.readFileSync(`./deploys/${config.get('network.name')}/custodian.address`, 'utf8');
  const artifact = await hre.artifacts.readArtifact('CustodianImplementationV2');
  const contract = new ethers.Contract(address, artifact.abi, owner);
  console.log(`setting custodian PGP public key on network ${config.get('network.name')}`);
  console.log(`pgpPubKey: ${pgpPubKey}`);
  const tx = await contract.setPgpPublicKey(pgpPubKey);
  console.log(`${tx.hash}`);
  await tx.wait();
  console.log(`done ${tx.hash}`);
  const key = await contract.pgpPublicKey();
  console.log(`contract PGP key:
${key}`);
}

main(process.argv[2]).then(() => {
  console.log('MIGRATION DONE');
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
