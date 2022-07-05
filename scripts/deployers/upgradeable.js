const hre = require('hardhat');

const vanity = require('./vanity');
const constructorBytes = require('./constructor-bytes');

module.exports = async ({
  name,
  deployer,
  owner,
  admin,
  artifactName,
  initFunction,
  initArgs,
  shouldContain = '0x',
  specificSalt = undefined,
}) => {
  const artifact = await hre.artifacts.readArtifact(artifactName);

  const upgradeableArtifact = await hre.artifacts.readArtifact('UpgradeableContract');

  const implementation = await vanity({
    deployer,
    owner,
    shouldContain: '0x',
    artifact,
  });

  const upgrade = await vanity({
    deployer,
    owner,
    shouldContain,
    specificSalt,
    artifact: upgradeableArtifact,
    constructorBytes: constructorBytes({
      implementation: implementation.contract,
      admin,
      initFunction,
      initArgs,
    }),
  });

  return {
    implementation,
    upgrade,
    contract: upgrade.contract,
    salt: upgrade.salt,
  };
};
