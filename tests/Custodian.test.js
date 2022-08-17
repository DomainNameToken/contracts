const { ethers, waffle } = require('hardhat');
const chai = require('chai');

chai.use(waffle.solidity);
const { expect } = chai;

describe('Custodian', () => {
  let admin;
  let allAccounts;
  let otherAccounts;
  let AdminProxy;
  let adminProxy;

  let CustodianImplementation;
  let custodianProxy;
  let custodianImplementation;
  let custodianGateway;
  let externalCallTestContract;
  let ExternalCallContract;
  let UpgredeableContract;

  before(async () => {
    allAccounts = await ethers.getSigners();
    [admin, ...otherAccounts] = allAccounts;

    UpgredeableContract = await ethers.getContractFactory('UpgradeableContract');
    CustodianImplementation = await ethers.getContractFactory('CustodianImplementation');

    AdminProxy = await ethers.getContractFactory('AdminProxy');
    ExternalCallContract = await ethers.getContractFactory('ExternalTest');
  });
  beforeEach(async () => {
    adminProxy = await AdminProxy.deploy();

    custodianImplementation = await CustodianImplementation.deploy();

    const custodianInitData = custodianImplementation.interface.encodeFunctionData('initialize(string,string)', [
      'DNT-TEST', 'http://localhost/',
    ]);

    custodianProxy = await UpgredeableContract.deploy(custodianImplementation.address, adminProxy.address, custodianInitData);

    custodianGateway = custodianImplementation.attach(custodianProxy.address);

    externalCallTestContract = await ExternalCallContract.deploy();
  });

  it('should correctly deploy', async () => {
    const custodianName = await custodianGateway.name();
    const custodianBaseUrl = await custodianGateway.baseUrl();

    expect(custodianName).to.equal('DNT-TEST');
    expect(custodianBaseUrl).to.equal('http://localhost/');
  });

  it('should correctly add and remove operator', async () => {
    await custodianGateway.addOperator(admin.address);
    await custodianGateway.addOperator(otherAccounts[0].address);
    await custodianGateway.addOperator(otherAccounts[1].address);
    const isOperator1 = await custodianGateway.isOperator(admin.address);
    const isOperator2 = await custodianGateway.isOperator(otherAccounts[0].address);
    const isOperator3 = await custodianGateway.isOperator(otherAccounts[1].address);
    expect(isOperator1).to.equal(true);
    expect(isOperator2).to.equal(true);
    expect(isOperator3).to.equal(true);
  });

  it('should correctly remove operator', async () => {
    await custodianGateway.addOperator(admin.address);
    await custodianGateway.addOperator(otherAccounts[0].address);
    await custodianGateway.addOperator(otherAccounts[1].address);
    const isOperator1 = await custodianGateway.isOperator(admin.address);
    const isOperator2 = await custodianGateway.isOperator(otherAccounts[0].address);
    let isOperator3 = await custodianGateway.isOperator(otherAccounts[1].address);
    expect(isOperator1).to.equal(true);
    expect(isOperator2).to.equal(true);
    expect(isOperator3).to.equal(true);

    await custodianGateway.removeOperator(otherAccounts[1].address);

    isOperator3 = await custodianGateway.isOperator(otherAccounts[1].address);
    expect(isOperator3).to.equal(false);
  });

  it('should correctly verify operator message', async () => {
    await custodianGateway.addOperator(admin.address);

    const messageHash = ethers.utils.solidityKeccak256(
      ['uint256'],
      [
        100,
      ],
    );
    const signature = await admin.signMessage(ethers.utils.arrayify(messageHash));
    const isValid = await custodianGateway.checkSignature(messageHash, signature);
    expect(isValid).to.equal(true);

    const signatureNotOperator = await otherAccounts[0].signMessage(ethers.utils.arrayify(messageHash));

    const isInValid = await custodianGateway.checkSignature(messageHash, signatureNotOperator);
    expect(isInValid).to.equal(false);
  });

  it('should call external contract', async () => {
    await custodianGateway.addOperator(admin.address);

    const externalCallData = externalCallTestContract.interface.encodeFunctionData('externalCallTest()', []);

    await expect(custodianGateway.externalCall(externalCallTestContract.address, externalCallData))
      .to.emit(externalCallTestContract, 'ExternalCallReceived')
      .withArgs(custodianGateway.address);
  });

  it('should call external contract with permit', async () => {
    await custodianGateway.addOperator(admin.address);

    const signatureNonceGroup = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string'], ['external.call.test']));
    const signatureNonce = 100;
    const externalCallData = externalCallTestContract.interface.encodeFunctionData('externalCallTest()', []);

    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'bytes', 'bytes32', 'uint256'],
        [externalCallTestContract.address,
          externalCallData,
          signatureNonceGroup,
          signatureNonce,
        ],
      ),
    );
    const signature = await admin.signMessage(ethers.utils.arrayify(hash));

    await expect(custodianGateway.externalCallWithPermit(
      externalCallTestContract.address,
      externalCallData,
      signature,
      signatureNonceGroup,
      signatureNonce,
    ))
      .to.emit(externalCallTestContract, 'ExternalCallReceived')
      .withArgs(custodianGateway.address);
  });
  it('should enable tlds', async () => {
    await custodianGateway.addOperator(admin.address);

    const tlds = ['com', 'net', 'org'];
    await custodianGateway.enableTlds(tlds);
    for (let i = 0; i < tlds.length; i++) {
      const isTldEnabled = await custodianGateway['isTldEnabled(string)'](tlds[i]);
      expect(isTldEnabled).to.equal(true);
    }
    const enabledTlds = await custodianGateway.getTlds();
    expect(enabledTlds).to.eql(tlds);
  });
  it('should disable tlds', async () => {
    await custodianGateway.addOperator(admin.address);

    const tlds = ['com', 'net', 'org'];
    await custodianGateway.enableTlds(tlds);
    for (let i = 0; i < tlds.length; i++) {
      const isTldEnabled = await custodianGateway['isTldEnabled(string)'](tlds[i]);
      expect(isTldEnabled).to.equal(true);
    }
    let enabledTlds = await custodianGateway.getTlds();
    expect(enabledTlds).to.eql(tlds);
    await custodianGateway.disableTlds(['com']);
    enabledTlds = await custodianGateway.getTlds();
    for (let i = 0; i < enabledTlds.length; i++) {
      expect(['org', 'net'].includes(enabledTlds[i])).to.equal(true);
    }
  });
});
