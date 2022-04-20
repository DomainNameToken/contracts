const hre = require('hardhat');
const deployment = require('../src/deployment');

async function main() {
  
  await hre.run('compile');

  
}

main().then(() => {
  console.log('MIGRATIONS DONE');
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
