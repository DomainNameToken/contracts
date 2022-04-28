require('dotenv').config();
const convict = require('convict');
const fs = require('fs');
const path = require('path');

const lowerCaseString = {
  name: 'lowercase-string',
  validate: (val) => true,
  coerce: (val) => val.toLowerCase(),
};

const accountsFormat = {
  name: 'accounts',
  validate: (val) => true,
  coerce: (val) => {
    const addressesKeys = val.split(',');
    return addressesKeys.filter((x) => !!x);
  },
};

convict.addFormat(accountsFormat);
convict.addFormat(lowerCaseString);

const config = convict({
  network: {
    name: {
      format: 'lowercase-string',
      default: 'development',
      env: 'NETWORK',
    },
    providerHttp: {
      format: String,
      default: 'http://localhost:8545',
      env: 'PROVIDER_HTTP',
    },
    accounts: {
      format: 'accounts',
      default: [],
      env: 'ACCOUNTS',
    },
    providerHttpHardhat: {
      format: String,
      default: 'http://localhost:8545',
      env: 'PROVIDER_HTTP_TEST',
    },
    hardhatTestBlock: {
      format: String,
      default: '0',
      env: 'TEST_BLOCK',
    },
  },
  etherscan: {
    apiKey: {
      format: String,
      default: 'none',
      env: 'ETHERSCAN_API_KEY',
    },
  },
  gasPrice: {
    maxGasPrice: {
      format: String,
      default: '300000000000000',
      env: 'MAX_GAS_PRICE',

    },
    maxPriorityFeePerGas: {
      format: String,
      default: '300000000000000',
      env: 'MAX_PRIORITY_FEE_PER_GAS',
    },
  },
});

config.validate({ allowed: 'strict' });

convict.initDev = () => {
  if (config.get('network.name') == 'development') {
    if (fs.existsSync('./ganache-accounts')) {
      const privateKeys = fs.readFileSync('./ganache-accounts', { encoding: 'utf8' }).split(',').map((k) => k.trim());
      config.set('network.accounts', privateKeys);
    }
  }
  return config.get('network.accounts');
};

config.isHardhat = () => config.get('network.name') == 'hardhat';

convict.initDev();

module.exports = config;
