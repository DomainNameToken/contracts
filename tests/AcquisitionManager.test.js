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
  hashOrderInformation,
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
  let AcquisitionManagerImplementation;

  let domainProxy;
  let domainGateway;
  let domainImplementation;
  let custodianProxy;
  let custodianImplementation;
  let custodianGateway;

  let acquisitionManager;

  let nonce = 1000;
  const ZEROA = ethers.constants.AddressZero;
  const now = () => Math.floor(Date.now() / 1000);
  const testDomainName = 'testdomain.com';
  before(async () => {
    allAccounts = await ethers.getSigners();
    [admin, ...otherAccounts] = allAccounts;
    userAccount = otherAccounts[2];
    // UpgradeableContract = await ethers.getContractFactory('UpgradeableContract');
    DomainImplementation = await ethers.getContractFactory('DomainTokenBase');
    CustodianImplementation = await ethers.getContractFactory('CustodianImplementationV1');
    AcquisitionManagerImplementation = await ethers.getContractFactory('AcquisitionManager');
  });
  beforeEach(async () => {
    custodianImplementation = await CustodianImplementation.deploy();
    await custodianImplementation.initialize('DNT-TEST', 'http://localhost/');
    domainImplementation = await DomainImplementation.deploy();
    await domainImplementation.initialize(
      custodianImplementation.address,
      'DOMAIN',
      'Domains',
    );
    acquisitionManager = await AcquisitionManagerImplementation.deploy();
    await acquisitionManager.initialize(custodianImplementation.address);
    await custodianImplementation.addOperator(admin.address);
  });
  it('should correctly deploy', async () => {
    const custodianAddress = await acquisitionManager.custodian();
    expect(custodianAddress).to.equal(custodianImplementation.address);
  });
  it('should correctly open registration order with native asset payment option', async () => {
    nonce += 1;
    const info = {
      tokenContract: domainImplementation.address,
      customer: allAccounts[2].address,
      chainId: (await ethers.provider.getNetwork()).chainId,
      orderType: 0, // register
      tokenId: encodeDomainToId(testDomainName),
      numberOfYears: 1,
      paymentToken: ZEROA,
      paymentAmount: ethers.utils.parseUnits('0.01', 18),
      paymentWindow: 15 * 60,
      requestTime: now(),
      openWindow: 24 * 3600,
      nonce,
    };
    const hash = hashOrderInformation(info);
    const signature = await admin.signMessage(ethers.utils.arrayify(hash));
    await expect(acquisitionManager.connect(allAccounts[2]).request(info, signature, { value: info.paymentAmount }))
      .to
      .emit(acquisitionManager, 'OrderOpen(uint256,uint256,address,uint256,uint256)')
      .withArgs(1, info.tokenId, info.customer, info.orderType, info.numberOfYears);
    const expectedActiveOrderId = 1;
    expect(await acquisitionManager.book(info.tokenId)).to.equal(1);
    const order = await acquisitionManager.orders(1);
    expect(order.tokenId).to.equal(info.tokenId);
  });
  it('should correctly initiate order', async () => {
    nonce += 1;
    const info = {
      tokenContract: domainImplementation.address,
      customer: allAccounts[2].address,
      chainId: (await ethers.provider.getNetwork()).chainId,
      orderType: 0, // register
      tokenId: encodeDomainToId(testDomainName),
      numberOfYears: 1,
      paymentToken: ZEROA,
      paymentAmount: ethers.utils.parseUnits('0.01', 18),
      paymentWindow: 15 * 60,
      requestTime: now(),
      openWindow: 24 * 3600,
      nonce,
    };
    const hash = hashOrderInformation(info);
    const signature = await admin.signMessage(ethers.utils.arrayify(hash));
    await expect(acquisitionManager.connect(allAccounts[2]).request(info, signature, { value: info.paymentAmount }))
      .to
      .emit(acquisitionManager, 'OrderOpen(uint256,uint256,address,uint256,uint256)')
      .withArgs(1, info.tokenId, info.customer, info.orderType, info.numberOfYears);
    const expectedActiveOrderId = 1;
    expect(await acquisitionManager.book(info.tokenId)).to.equal(1);
    let order = await acquisitionManager.orders(1);
    expect(order.tokenId).to.equal(info.tokenId);
    await expect(acquisitionManager.initiate(1))
      .to
      .emit(acquisitionManager, 'OrderInitiated(uint256)')
      .withArgs(1);
    order = await acquisitionManager.orders(1);
    expect(order.status).to.equal(1);
  });
  it('should correctly mark order as success and mint domain', async () => {
    nonce += 1;
    const info = {
      tokenContract: domainImplementation.address,
      customer: allAccounts[2].address,
      chainId: (await ethers.provider.getNetwork()).chainId,
      orderType: 0, // register
      tokenId: encodeDomainToId(testDomainName),
      numberOfYears: 1,
      paymentToken: ZEROA,
      paymentAmount: ethers.utils.parseUnits('0.01', 18),
      paymentWindow: 15 * 60,
      requestTime: now(),
      openWindow: 24 * 3600,
      nonce,
    };
    const hash = hashOrderInformation(info);
    const signature = await admin.signMessage(ethers.utils.arrayify(hash));
    await expect(acquisitionManager.connect(allAccounts[2]).request(info, signature, { value: info.paymentAmount }))
      .to
      .emit(acquisitionManager, 'OrderOpen(uint256,uint256,address,uint256,uint256)')
      .withArgs(1, info.tokenId, info.customer, info.orderType, info.numberOfYears);
    const expectedActiveOrderId = 1;
    expect(await acquisitionManager.book(info.tokenId)).to.equal(1);
    let order = await acquisitionManager.orders(1);
    expect(order.tokenId).to.equal(info.tokenId);
    await expect(acquisitionManager.initiate(1))
      .to
      .emit(acquisitionManager, 'OrderInitiated(uint256)')
      .withArgs(1);
    order = await acquisitionManager.orders(1);
    expect(order.status).to.equal(1);

    const successData = domainImplementation.interface.encodeFunctionData('mint((uint256,address,uint256,(uint256,address,uint256),(uint256,address,uint256),string,uint256))', [
      [
        messageType('mint'),
        custodianImplementation.address,
        info.tokenId,
        [0, info.customer, 0],
        [info.chainId, info.customer, 0],
        testDomainName,
        now() + 365 * 24 * 3600,
      ],
    ]);
    const signatureNonceGroup = nonceGroupId('domains.mint');
    const signatureNonce = 100;
    const successDataHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'bytes', 'bytes32', 'uint256'],
        [domainImplementation.address,
          successData,
          signatureNonceGroup,
          signatureNonce],
      ),
    );
    const successDataSignature = await admin.signMessage(ethers.utils.arrayify(successDataHash));
    await expect(acquisitionManager.success(1, successData, successDataSignature, signatureNonceGroup, signatureNonce))
      .to
      .emit(acquisitionManager, 'OrderSuccess(uint256)')
      .withArgs(1);
    order = await acquisitionManager.orders(1);
    expect(order.status).to.equal(2); // expect status == SUCCESS

    const domainInfo = await domainImplementation.getDomainInfo(info.tokenId);
    expect(domainInfo.name).to.equal(testDomainName);
  });
});
