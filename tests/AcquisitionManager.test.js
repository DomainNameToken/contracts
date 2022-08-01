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
  encodeDomainToId,
  hashOrderInformation,
  getAcquisitionOrderInfo,
  messageType,
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

  let MockChainlinkAggregator;
  let mockChainlinkAggregator;

  let nonce = 1000;
  const ZEROA = ethers.constants.AddressZero;
  const now = () => Math.floor(Date.now() / 1000);
  const testDomainName = 'testdomain.com';
  let nativePriceRoundingDecimals = 16; // eslint-disable-line
  let aggregatorPrice = 84912020; // eslint-disable-line
  let aggregatorDecimals = 8; // eslint-disable-line
  const standardPriceDecimals = 2;
  before(async () => {
    allAccounts = await ethers.getSigners();
    [admin, ...otherAccounts] = allAccounts;
    userAccount = otherAccounts[2];
    // UpgradeableContract = await ethers.getContractFactory('UpgradeableContract');
    DomainImplementation = await ethers.getContractFactory('DomainImplementationV2');
    CustodianImplementation = await ethers.getContractFactory('CustodianImplementationV2');
    AcquisitionManagerImplementation = await ethers.getContractFactory('AcquisitionManagerImplementationV2');
    MockERC20Token = await ethers.getContractFactory('MockERC20Token');
    MockChainlinkAggregator = await ethers.getContractFactory('MockChainlinkAggregator');
  });
  beforeEach(async () => {
    custodianImplementation = await CustodianImplementation.deploy();
    await custodianImplementation.initialize('DNT-TEST', 'http://localhost/');
    domainImplementation = await DomainImplementation.deploy();
    await domainImplementation.initialize(
      custodianImplementation.address,
      'DOMAIN',
      'Domains',
      ' ',
      '-',
    );
    mockChainlinkAggregator = await MockChainlinkAggregator.deploy(aggregatorDecimals, aggregatorPrice);
    acquisitionManager = await AcquisitionManagerImplementation.deploy();
    await acquisitionManager.initialize(
      custodianImplementation.address,
      domainImplementation.address,
      mockChainlinkAggregator.address,
      nativePriceRoundingDecimals,
      standardPriceDecimals,
    );
    await custodianImplementation.addOperator(admin.address);
    mockERC20Token = await MockERC20Token.deploy('PAYMENT', 'PAYMENT', 6);
    await acquisitionManager.addStableToken(mockERC20Token.address);
  });
  it('should correctly deploy', async () => {
    const custodianAddress = await acquisitionManager.custodian();
    expect(custodianAddress).to.equal(custodianImplementation.address);
    expect(await acquisitionManager.domainToken()).to.equal(domainImplementation.address);
    expect(await acquisitionManager.getAcceptedStableTokens()).to.deep.equal([mockERC20Token.address]);
  });
  it('should correctly calculate stable price of a tld', async () => {
    await acquisitionManager.setStandardPrice(['com', 'net', 'org'], [2000, 3000, 5000]);
    expect(await acquisitionManager.getStandardPrice('com')).to.equal(2000);
    expect(await acquisitionManager.getStandardPrice('net')).to.equal(3000);
    expect(await acquisitionManager.getStandardPrice('org')).to.equal(5000);
    expect(await acquisitionManager.getStablePrice('com', mockERC20Token.address)).to.equal(20000000);
  });
  it('should correctly calculate native price of a tld', async () => {
    await acquisitionManager.setStandardPrice(['com'], [2000]);
    const expectedPrice = ethers.utils.parseUnits('23.55', 18);
    expect(await acquisitionManager.getNativePrice('com')).to.equal(expectedPrice);
  });
  const requestRegistrationOrder = async ({
    customer = allAccounts[2],
    years = 1,
    paymentToken = ZEROA,
    paymentAmount,
    tld = 'com',
    tldPrice = 2000,
  }) => {
    nonce += 1;
    await acquisitionManager.setStandardPrice([tld], [tldPrice]);
    await custodianImplementation.enableTlds([tld]);
    const { orderInfo, hash, signature } = await getAcquisitionOrderInfo({
      domainToken: domainImplementation,
      custodian: custodianImplementation,
      customer,
      orderType: 1,
      domainName: testDomainName,
      years: 1,
      nonce,
      admin,
      tld,
      data: 'hello',
      paymentAmount,
      paymentToken,
    });
    if (paymentToken != ZEROA) {
      await mockERC20Token.mint(customer.address, ethers.utils.parseUnits('20', 6));
      await mockERC20Token.connect(customer).approve(acquisitionManager.address, ethers.utils.parseUnits('20', 6));
      await expect(acquisitionManager.connect(customer)
        .request(orderInfo))
        .to
        .emit(acquisitionManager, 'OrderOpen(uint256,uint256,address,uint256,uint256,string,string)')
        .withArgs(
          1,
          orderInfo.tokenId,
          orderInfo.customer,
          orderInfo.orderType,
          orderInfo.numberOfYears,
          tld,
          orderInfo.data,
        );
    } else {
      const balanceOfManagerBefore = await ethers.provider.getBalance(acquisitionManager.address);
      await expect(acquisitionManager.connect(customer)
        .request(orderInfo, { value: orderInfo.paymentAmount.mul(2) }))
        .to
        .emit(acquisitionManager, 'OrderOpen(uint256,uint256,address,uint256,uint256,string,string)')
        .withArgs(
          1,
          orderInfo.tokenId,
          orderInfo.customer,
          orderInfo.orderType,
          orderInfo.numberOfYears,
          tld,
          orderInfo.data,
        );
      const balanceOfManagerAfter = await ethers.provider.getBalance(acquisitionManager.address);
      expect(balanceOfManagerAfter.sub(balanceOfManagerBefore)).to.equal(orderInfo.paymentAmount);
    }
    const expectedActiveOrderId = 1;
    expect(await acquisitionManager.book(orderInfo.tokenId)).to.equal(1);
    const order = await acquisitionManager.orders(1);
    expect(order.tokenId).to.equal(orderInfo.tokenId);

    return { orderInfo, orderId: 1 };
  };
  it('should correctly open registration order with native asset payment option', async () => {
    await requestRegistrationOrder({
      paymentAmount: ethers.utils.parseUnits('23.55', 18),
    });
  });
  it('should correctly open registration order with token payment option', async () => {
    await requestRegistrationOrder({
      paymentToken: mockERC20Token.address,
      paymentAmount: ethers.utils.parseUnits('20', 6),
    });
  });
  it('should correctly initiate order', async () => {
    const { orderInfo, orderId } = await requestRegistrationOrder({
      paymentToken: mockERC20Token.address,
      paymentAmount: ethers.utils.parseUnits('20', 6),
    });

    let order = await acquisitionManager.orders(orderId);
    expect(order.tokenId).to.equal(orderInfo.tokenId);
    await expect(acquisitionManager.initiate(orderId))
      .to
      .emit(acquisitionManager, 'OrderInitiated(uint256)')
      .withArgs(orderId);
    order = await acquisitionManager.orders(orderId);
    expect(order.status).to.equal(2);
  });
  it('should correctly mark order as success and mint domain', async () => {
    const { orderInfo, orderId } = await requestRegistrationOrder({
      paymentToken: mockERC20Token.address,
      paymentAmount: ethers.utils.parseUnits('20', 6),
    });
    await expect(acquisitionManager.initiate(orderId))
      .to
      .emit(acquisitionManager, 'OrderInitiated(uint256)')
      .withArgs(orderId);
    let order = await acquisitionManager.orders(orderId);
    expect(order.status).to.equal(2);
    const successData = encodeDomainInfoFn(
      domainImplementation,
      'mint',
      {
        messageType: messageType('mint'),
        custodian: custodianImplementation.address,
        tokenId: orderInfo.tokenId,
        owner: allAccounts[2].address,
        domainName: testDomainName,
        expiry: now() + (365 * 24 * 60 * 60 * orderInfo.numberOfYears),

      },
      domainImplementation,
    );
    const signatureNonceGroup = nonceGroupId('mint');
    const signatureNonce = 1000;
    const successHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'bytes', 'bytes32', 'uint256'],
        [domainImplementation.address, successData, signatureNonceGroup, signatureNonce],
      ),
    );
    const successSignature = await admin.signMessage(ethers.utils.arrayify(successHash));
    const balanceBeforeSuccess = await mockERC20Token.balanceOf(allAccounts[0].address);
    await expect(acquisitionManager.success(1, successData, successSignature, signatureNonceGroup, signatureNonce))
      .to
      .emit(acquisitionManager, 'OrderSuccess(uint256)')
      .withArgs(1);
    order = await acquisitionManager.orders(1);
    expect(order.status).to.equal(3); // expect status == SUCCESS
    const balanceAfterSuccess = await mockERC20Token.balanceOf(allAccounts[0].address);
    expect(balanceAfterSuccess.sub(balanceBeforeSuccess)).to.equal(orderInfo.paymentAmount);
    const domainInfo = await domainImplementation.getDomainInfo(orderInfo.tokenId);
    expect(domainInfo.name).to.equal(testDomainName);
    const ownerOfDomain = await domainImplementation.ownerOf(orderInfo.tokenId);
    expect(ownerOfDomain).to.equal(allAccounts[2].address);
  });

  it('should correctly mark order as FAILED', async () => {
    const { orderInfo, orderId } = await requestRegistrationOrder({
      paymentToken: mockERC20Token.address,
      paymentAmount: ethers.utils.parseUnits('20', 6),
    });
    await expect(acquisitionManager.initiate(orderId))
      .to
      .emit(acquisitionManager, 'OrderInitiated(uint256)')
      .withArgs(orderId);
    let order = await acquisitionManager.orders(orderId);
    expect(order.status).to.equal(2);

    await expect(acquisitionManager.fail(1, false))
      .to
      .emit(acquisitionManager, 'OrderFail(uint256)')
      .withArgs(1);
    order = await acquisitionManager.orders(1);
    expect(order.status).to.equal(4); // expect status == FAILED
  });

  it('should correctly mark order as FAILED with refund', async () => {
    const { orderInfo, orderId } = await requestRegistrationOrder({
      paymentToken: mockERC20Token.address,
      paymentAmount: ethers.utils.parseUnits('20', 6),
    });
    await expect(acquisitionManager.initiate(orderId))
      .to
      .emit(acquisitionManager, 'OrderInitiated(uint256)')
      .withArgs(orderId);
    let order = await acquisitionManager.orders(orderId);
    expect(order.status).to.equal(2);

    await expect(acquisitionManager.fail(1, true))
      .to
      .emit(acquisitionManager, 'OrderFail(uint256)')
      .withArgs(1);
    order = await acquisitionManager.orders(1);
    expect(order.status).to.equal(5); // expect status == FAILED
  });
});
