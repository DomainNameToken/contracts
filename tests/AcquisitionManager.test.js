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
  getAcquisitionOrderInfo,
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

  let MockERC20Token;
  let mockERC20Token;

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
    MockERC20Token = await ethers.getContractFactory('MockERC20Token');
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
    mockERC20Token = await MockERC20Token.deploy('PAYMENT', 'PAYMENT', 6);
  });
  it('should correctly deploy', async () => {
    const custodianAddress = await acquisitionManager.custodian();
    expect(custodianAddress).to.equal(custodianImplementation.address);
  });
  it('should correctly open registration order with native asset payment option', async () => {
    nonce += 1;

    const { orderInfo, hash, signature } = await getAcquisitionOrderInfo({
      domainToken: domainImplementation,
      custodian: custodianImplementation,
      customer: allAccounts[2],
      orderType: 0,
      domainName: testDomainName,
      years: 1,
      nonce,
      admin,
    });

    await expect(acquisitionManager.connect(allAccounts[2]).request(orderInfo, signature, { value: orderInfo.paymentAmount }))
      .to
      .emit(acquisitionManager, 'OrderOpen(uint256,uint256,address,uint256,uint256)')
      .withArgs(1, orderInfo.tokenId, orderInfo.customer, orderInfo.orderType, orderInfo.numberOfYears);
    const expectedActiveOrderId = 1;
    expect(await acquisitionManager.book(orderInfo.tokenId)).to.equal(1);
    const order = await acquisitionManager.orders(1);
    expect(order.tokenId).to.equal(orderInfo.tokenId);
  });
  it('should correctly initiate order', async () => {
    nonce += 1;
    const { orderInfo: info, hash, signature } = await getAcquisitionOrderInfo({
      domainToken: domainImplementation,
      custodian: custodianImplementation,
      customer: allAccounts[2],
      orderType: 0,
      domainName: testDomainName,
      years: 1,
      nonce,
      admin,
    });

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
    const {
      orderInfo: info, hash, signature,
      success,
    } = await getAcquisitionOrderInfo({
      domainToken: domainImplementation,
      custodian: custodianImplementation,
      customer: allAccounts[2],
      orderType: 0,
      domainName: testDomainName,
      years: 1,
      nonce,
      admin,
    });

    await expect(acquisitionManager
      .connect(allAccounts[2])
      .request(info, signature, { value: info.paymentAmount }))
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

    const successData = success.data;
    const {
      signatureNonceGroup, signatureNonce,
      hash: successDataHash,
      signature: successDataSignature,
    } = success;

    await expect(acquisitionManager.success(1, successData, successDataSignature, signatureNonceGroup, signatureNonce))
      .to
      .emit(acquisitionManager, 'OrderSuccess(uint256)')
      .withArgs(1);
    order = await acquisitionManager.orders(1);
    expect(order.status).to.equal(2); // expect status == SUCCESS

    const domainInfo = await domainImplementation.getDomainInfo(info.tokenId);
    expect(domainInfo.name).to.equal(testDomainName);
  });

  it('should correctly create a successful order with token payment', async () => {
    nonce += 1;
    const {
      orderInfo: info, hash, signature,
      success,
    } = await getAcquisitionOrderInfo({
      domainToken: domainImplementation,
      custodian: custodianImplementation,
      customer: allAccounts[2],
      orderType: 0,
      domainName: testDomainName,
      paymentToken: mockERC20Token,
      paymentAmount: ethers.utils.parseUnits('50', 6),
      years: 1,
      nonce,
      admin,
    });

    await mockERC20Token.mint(allAccounts[2].address, info.paymentAmount);
    await mockERC20Token.connect(allAccounts[2]).approve(acquisitionManager.address, info.paymentAmount);

    await expect(acquisitionManager.connect(allAccounts[2]).request(info, signature))
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
    let paymentTokenBalanceOfAccount = await mockERC20Token.balanceOf(allAccounts[2].address);
    expect(paymentTokenBalanceOfAccount).to.equal(0);
    paymentTokenBalanceOfAccount = await mockERC20Token.balanceOf(acquisitionManager.address);
    expect(paymentTokenBalanceOfAccount).to.equal(info.paymentAmount);

    const {
      data: successData, signatureNonce, signatureNonceGroup, hash: successDataHash, signature: successDataSignature,
    } = success;

    await expect(acquisitionManager.success(1, successData, successDataSignature, signatureNonceGroup, signatureNonce))
      .to
      .emit(acquisitionManager, 'OrderSuccess(uint256)')
      .withArgs(1);
    order = await acquisitionManager.orders(1);
    expect(order.status).to.equal(2); // expect status == SUCCESS

    const domainInfo = await domainImplementation.getDomainInfo(info.tokenId);
    expect(domainInfo.name).to.equal(testDomainName);
    paymentTokenBalanceOfAccount = await mockERC20Token.balanceOf(admin.address);
    expect(paymentTokenBalanceOfAccount).to.equal(info.paymentAmount);
    paymentTokenBalanceOfAccount = await mockERC20Token.balanceOf(acquisitionManager.address);
    expect(paymentTokenBalanceOfAccount).to.equal(0);
  });

  it('should correctly mark order as FAILED', async () => {
    nonce += 1;
    const info = {
      tokenContract: domainImplementation.address,
      customer: allAccounts[2].address,
      chainId: (await ethers.provider.getNetwork()).chainId,
      orderType: 2, // register
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

    await expect(acquisitionManager.fail(1, false))
      .to
      .emit(acquisitionManager, 'OrderFail(uint256)')
      .withArgs(1);
    order = await acquisitionManager.orders(1);
    expect(order.status).to.equal(3); // expect status == FAILED
  });

  it('should correctly mark order as FAILED with refund ( using payment token )', async () => {
    nonce += 1;
    const {
      orderInfo: info, hash, signature,
      success,
    } = await getAcquisitionOrderInfo({
      domainToken: domainImplementation,
      custodian: custodianImplementation,
      customer: allAccounts[2],
      orderType: 0,
      domainName: testDomainName,
      paymentToken: mockERC20Token,
      paymentAmount: ethers.utils.parseUnits('50', 6),
      years: 1,
      nonce,
      admin,
    });

    await mockERC20Token.mint(allAccounts[2].address, info.paymentAmount);
    await mockERC20Token.connect(allAccounts[2]).approve(acquisitionManager.address, info.paymentAmount);

    await expect(acquisitionManager.connect(allAccounts[2]).request(info, signature))
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
    let paymentTokenBalanceOfAccount = await mockERC20Token.balanceOf(allAccounts[2].address);
    expect(paymentTokenBalanceOfAccount).to.equal(0);
    paymentTokenBalanceOfAccount = await mockERC20Token.balanceOf(acquisitionManager.address);
    expect(paymentTokenBalanceOfAccount).to.equal(info.paymentAmount);

    await expect(acquisitionManager.fail(1, true))
      .to
      .emit(acquisitionManager, 'OrderFail(uint256)')
      .withArgs(1);
    order = await acquisitionManager.orders(1);
    expect(order.status).to.equal(4); // expect status == REFUND

    paymentTokenBalanceOfAccount = await mockERC20Token.balanceOf(admin.address);
    expect(paymentTokenBalanceOfAccount).to.equal(0);
    paymentTokenBalanceOfAccount = await mockERC20Token.balanceOf(acquisitionManager.address);
    expect(paymentTokenBalanceOfAccount).to.equal(0);
    paymentTokenBalanceOfAccount = await mockERC20Token.balanceOf(info.customer);
    expect(paymentTokenBalanceOfAccount).to.equal(info.paymentAmount);
  });
});
