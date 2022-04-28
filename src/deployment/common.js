const hre = require('hardhat');
const fs = require('fs');

const getGasPrice = async ({
  provider, ethers, maxGasPrice, maxPriorityFeePerGas,
  log = console.log,
} = {
  maxGasPrice: hre.config.gasPrice.maxGasPrice,
  ethers: hre.ethers,
  maxPriorityFeePerGas: hre.config.gasPrice.maxPriorityFeePerGas,
  provider: hre.ethers.provider,
}) => {
  const currentGasPrice = await provider.getGasPrice();
  let _maxFeePerGas = ethers.BigNumber.from(maxGasPrice);

  let _maxPriorityFeePerGas = ethers.utils.parseUnits('100', 'gwei');// ethers.BigNumber.from(maxPriorityFeePerGas);

  const block = await provider.getBlock('latest');

  if (!block || !block.baseFeePerGas) {
    if (currentGasPrice.mul(185).div(100).gt(_maxFeePerGas)) {
      log(`gasPrice: ${ethers.utils.formatUnits(_maxFeePerGas, 'gwei')} gwei ( type 0 )`);
      return {
        gasPrice: _maxFeePerGas,
      };
    }
    log(`gasPrice: ${ethers.utils.formatUnits(currentGasPrice.mul(120).div(100), 'gwei')} gwei ( typeo 0 )`);
    return {
      gasPrice: currentGasPrice.mul(285).div(100),
    };
  }
  if (currentGasPrice.lt(_maxFeePerGas)) {
    // _maxFeePerGas = currentGasPrice.add(1000);
  }
  if (block.baseFeePerGas.gt(_maxFeePerGas)) {
    _maxFeePerGas = block.baseFeePerGas.mul(220).div(100).add(maxPriorityFeePerGas);
  }

  if (_maxPriorityFeePerGas.gt(_maxFeePerGas)) {
    _maxPriorityFeePerGas = _maxFeePerGas;
  }

  log(`_maxPriorityFeePerGas: ${ethers.utils.formatUnits(_maxPriorityFeePerGas, 'gwei')} gwei ( type 2 )`);
  log(`maxFeePerGas: ${ethers.utils.formatUnits(_maxFeePerGas, 'gwei')} gwei ( type 2 )`);
  log(`baseFeePerGas: ${ethers.utils.formatUnits(block.baseFeePerGas, 'gwei')} gwei ( type 2 )`);
  // log(`maxFeePerGas: ${ethers.utils.formatUnits(_maxFeePerGas, 'gwei')} gwei ( type 2 )`);
  // log(`maxPriorityFeePerGas: ${ethers.utils.formatUnits(_maxPriorityFeePerGas, 'gwei')} gwei ( type 2 )`);
  return {
    maxFeePerGas: _maxFeePerGas,
    maxPriorityFeePerGas: _maxPriorityFeePerGas,
  };
};

const migratedPath = (contractName = '', subpath = '') => {
  const p = `${hre.config.paths.root}/${hre.config.paths.migrated}-${hre.network.name}${subpath}${contractName !== '' ? '/' : ''}${contractName}${contractName !== '' ? '.json' : ''}`;
  console.log(p);
  return p;
};

const forceDirectory = (subpath = '') => {
  const rootDir = `${hre.config.paths.root}/${hre.config.paths.migrated}-${hre.network.name}${subpath}`;
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir);
  }
};

const hasSavedContract = (contractName, subpath = '') => {
  forceDirectory(subpath);
  const p = migratedPath(contractName, subpath);
  return fs.existsSync(p);
};

const saveContractData = async (contractName, data, subpath = '') => {
  forceDirectory(subpath);
  const m = migratedPath(contractName, subpath);
  const artifactData = await hre.artifacts.readArtifact(contractName);
  fs.writeFileSync(m, JSON.stringify({
    ...data,
    abi: artifactData.abi,
  }));
};

const savedContractData = (contractName, subpath = '') => {
  forceDirectory(subpath);
  if (!hasSavedContract(contractName, subpath)) {
    return null;
  }
  const fileContent = fs.readFileSync(migratedPath(contractName, subpath), { encoding: 'utf8' });

  const x = JSON.parse(fileContent);
  return x;
};

const currentStep = async (migrationsContract) => {
  const c = await migrationsContract.lastCompletedMigration();
  return parseInt(`${c}`, 10);
};

const incCurrentStep = async (migrationsContract) => {
  let cs = await currentStep(migrationsContract);
  cs += 1;
  const tx = await migrationsContract.setCompleted(cs, {
    ...(await getGasPrice()),
  });

  return tx.wait();
};

const setCurrentStep = async (migrationsContract, step) => {
  const tx = await migrationsContract.setCompleted(step, {
    ...(await getGasPrice()),
  });
  return tx.wait();
};

const awaitTx = async (tx) => {
  if (tx.wait) {
    console.log(`waiting ${tx.hash}`);
    const r = await tx.wait();
    return r;
  }
  const p = await tx;
  console.log(`waiting2 ${p.hash}`);
  const r = await p.wait();
  return r;
};

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

module.exports = {
  getGasPrice,
  hasSavedContract,
  savedContractData,
  saveContractData,
  currentStep,
  incCurrentStep,
  setCurrentStep,
  awaitTx,
  sleep,
};
