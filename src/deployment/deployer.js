const hre = require('hardhat');
const common = require('./common');
const waiter = require('./waiter');

module.exports = async (contractName, options) => {
  console.log(`Checking ${contractName} for deployment`);
  if (!common.hasSavedContract(contractName)) {
    console.log(`${contractName} does not exist, deploying`);
    const Contract = await hre.ethers.getContractFactory(contractName, { libraries: options.libraries || {} });
    console.log(`found ${contractName} factory`);
    const gasPrice = await common.getGasPrice();

    const contractp = Contract.deploy(
      ...(options.args || []),
      {
        ...gasPrice,

      },
    );
    console.log(`deployed ${contractName} waiting...`);
    const contractT = await waiter.wait(`deploying ${contractName} contract `, contractp);
    console.log('waiting deployed');
    const contract = await contractT.deployed();
    console.log('saving');
    await common.saveContractData(contractName, { address: contractT.address }, options.subpath);
    console.log('saved');
    if (options.verify && hre.config.etherscan && hre.config.etherscan.apiKey) {
      console.log(`Verifying contract ${contractName} on etherscan @ ${contractT.address}`);
      await hre.run('verify:verify', {
        address: contractT.address,
        constructorArguments: options.args || [],
        contract: options.contractPath || `${hre.config.paths.sources}/${contractName}.sol:${contractName}`,
      });
    }
  }
  const contractData = common.savedContractData(contractName, options.subpath);
  const contract = await hre.ethers.getContractAt(
    contractData.abi,
    contractData.address,
    await hre.ethers.getSigner(),
  );
  return contract;
};
