const hre = require('hardhat');
const fs = require('fs');

const { ethers } = hre;
const config = require('../config');

async function main() {
  const [owner] = await ethers.getSigners();

  const domainArtifact = await hre.artifacts.readArtifact('DomainImplementation');
  const domainAddress = fs.readFileSync(`./deploys/${config.get('network.name')}/domain.address`).toString();
  const domain = new ethers.Contract(domainAddress, domainArtifact.abi, owner);
  console.log(`domainAddress: ${domain.address}`);
  console.log(`${owner.address}`);
  const tx = await domain.setWithdrawLockWindow(90 * 24 * 60 * 60);
  console.log(`setting withdraw window to 90 days ${tx.hash}`);
  await tx.wait();
  const withdrawLockWindow = await domain.withdrawLockWindow();
  console.log(`withdrawLockWindow: ${withdrawLockWindow}`);
}

main().then(() => {
  console.log('Done');
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
