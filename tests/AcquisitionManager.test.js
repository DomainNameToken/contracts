const { ethers, waffle } = require('hardhat');
const chai = require('chai');

chai.use(waffle.solidity);
const { expect } = chai;

const {

  encodeDomainInfoFn,
  nonceGroupId,
  infoEncode,
  generateInfo,
  hashInformation,
  flattenArray,
  messageType,
  encodeDomainToId,
} = require('../src/utils');

describe('AcquisitionManager', () => {
  let admin;
  let allAccounts;
  let otherAccounts;
  let userAccount;
  let AdminProxy;
  let adminProxy;

  let UpgradeableContract;

  let DomainImplementation;
  let CustodianImplementation;

  let domainProxy;
  let domainGateway;
  let domainImplementation;
  let custodianProxy;
  let custodianImplementation;
  let custodianGateway;

  const nonce = 1000;
  const ZEROA = ethers.constants.AddressZero;
  const now = Math.floor(Date.now() / 1000);
});
