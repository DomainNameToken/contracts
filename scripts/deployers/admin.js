const hre = require('hardhat');
const fs = require('fs');
const vanityDeploy = require('./vanity');
const config = require('../../config');

const { ethers } = hre;

module.exports = async ({
  owner,
  deployer,
  specificSalt = undefined,
  shouldContain = '0x',
}) => {
  const contractDeploymentInfoPath = `./deploys/${config.get('network.name')}/admin.address`;
  const contractDeploymentSaltInfoPath = `./deploys/${config.get('network.name')}/admin.salt`;
  const artifact = await hre.artifacts.readArtifact('AdminProxy');
  if (fs.existsSync(contractDeploymentInfoPath)) {
    const contract = new ethers.Contract(
      fs.readFileSync(contractDeploymentInfoPath).toString(),
      artifact.abi,
      owner,
    );
    const salt = fs.readFileSync(contractDeploymentSaltInfoPath).toString();
    return { contract, salt };
  }
  const AdminProxy = await ethers.getContractFactory('AdminProxy');

  const deployment = await vanityDeploy({
    deployer,
    owner,
    shouldContain: specificSalt ? undefined : shouldContain,
    artifact,
    constructorBytes: undefined,
  });
  fs.writeFileSync(contractDeploymentInfoPath, `${deployment.address}`);
  fs.writeFileSync(contractDeploymentSaltInfoPath, `${deployment.salt}`);
  const contract = new ethers.Contract(deployment.address, artifact.abi, owner);
  return { contract, salt: deployment.salt };
};
