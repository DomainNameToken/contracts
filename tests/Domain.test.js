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
  now,
} = require('../src/utils');

describe('Domain', () => {
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

  before(async () => {
    allAccounts = await ethers.getSigners();
    [admin, ...otherAccounts] = allAccounts;
    userAccount = otherAccounts[0];
    UpgradeableContract = await ethers.getContractFactory('UpgradeableContract');
    DomainImplementation = await ethers.getContractFactory('DomainTokenBase');
    CustodianImplementation = await ethers.getContractFactory('CustodianImplementationV1');

    AdminProxy = await ethers.getContractFactory('AdminProxy');
  });
  beforeEach(async () => {
    adminProxy = await AdminProxy.deploy();

    custodianImplementation = await CustodianImplementation.deploy();

    const custodianInitData = custodianImplementation.interface.encodeFunctionData('initialize(string,string)', [
      'DNT-TEST', 'http://localhost/',
    ]);

    custodianProxy = await UpgradeableContract.deploy(custodianImplementation.address, adminProxy.address, custodianInitData);

    custodianGateway = custodianImplementation.attach(custodianProxy.address);

    domainImplementation = await DomainImplementation.deploy();

    const domainInitData = domainImplementation.interface.encodeFunctionData('initialize(address,string,string,uint256)', [
      custodianProxy.address,
      'DOMAIN', 'Domains',
      (await ethers.provider.getNetwork()).chainId,
    ]);

    domainProxy = await UpgradeableContract.deploy(domainImplementation.address, adminProxy.address, domainInitData);

    domainGateway = domainImplementation.attach(domainProxy.address);
  });
  const signCustodianExternalCall = async (admin, domainGateway, mintCallData, signatureNonceGroup, signatureNonce) => {
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'bytes', 'bytes32', 'uint256'],
        [domainGateway.address, mintCallData, signatureNonceGroup, signatureNonce],
      ),
    );

    const signature = await admin.signMessage(ethers.utils.arrayify(hash));
    return signature;
  };
  it('should correctly deploy', async () => {
    const custodianName = await custodianGateway.name();
    const name = await domainGateway.name();
    const symbol = await domainGateway.symbol();
    expect(symbol).to.equal('DOMAIN-DNT-TEST');
    expect(name).to.equal('DNT-TEST Domains');
  });

  it('should correctly mint', async () => {
    await custodianGateway.addOperator(admin.address);
    const domainName = 'test.com';

    const mintInfo = await generateInfo(custodianGateway, 'mint', domainName, ZEROA, userAccount);

    const mintCallData = encodeDomainInfoFn(domainGateway, 'mint', mintInfo, domainImplementation);

    const signatureNonceGroup = nonceGroupId(`dnt.domains.management.${mintInfo.tokenId}`);
    const signatureNonce = 100;

    const signature = await signCustodianExternalCall(admin, domainGateway, mintCallData, signatureNonceGroup, signatureNonce);

    await expect(custodianGateway.externalCallWithPermit(domainGateway.address, mintCallData, signature, signatureNonceGroup, signatureNonce))
      .to
      .emit(domainGateway, 'DomainMinted')
      .withArgs(
        mintInfo.destination.chainId,
        mintInfo.tokenId,
        0,
        mintInfo.destination.chainId,
        ZEROA,
        userAccount.address,
        mintInfo.expiry,
        'test.com',
      );

    const exists = await domainGateway.exists(mintInfo.tokenId);
    expect(exists).to.equal(true);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);
  });

  it('should correctly burn', async () => {
    await custodianGateway.addOperator(admin.address);
    const domainName = 'test.com';
    const mintInfo = await generateInfo(custodianGateway, 'mint', domainName, ZEROA, userAccount);
    const mintCallData = encodeDomainInfoFn(domainGateway, 'mint', mintInfo, domainImplementation);

    const signatureNonceGroup = nonceGroupId(`dnt.domains.management.${mintInfo.tokenId}`);
    const signatureNonce = 100;

    const signature = await signCustodianExternalCall(admin, domainGateway, mintCallData, signatureNonceGroup, signatureNonce);

    await expect(custodianGateway.externalCallWithPermit(domainGateway.address, mintCallData, signature, signatureNonceGroup, signatureNonce))
      .to
      .emit(domainGateway, 'DomainMinted')
      .withArgs(
        mintInfo.destination.chainId,
        mintInfo.tokenId,
        0,
        mintInfo.destination.chainId,
        ZEROA,
        userAccount.address,
        mintInfo.expiry,
        'test.com',
      );

    const exists = await domainGateway.exists(mintInfo.tokenId);
    expect(exists).to.equal(true);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);

    await domainGateway.connect(otherAccounts[0]).setLock(mintInfo.tokenId, false);

    const burnInfo = await generateInfo(custodianGateway, 'burn', domainName, userAccount.address, ZEROA);

    const burnCallData = encodeDomainInfoFn(domainGateway, 'burn', burnInfo, domainImplementation);

    const signatureNonceBurn = 110;

    const burnInfoSignature = await signCustodianExternalCall(admin, domainGateway, burnCallData, signatureNonceGroup, signatureNonceBurn);

    await expect(custodianGateway.externalCallWithPermit(domainGateway.address, burnCallData, burnInfoSignature, signatureNonceGroup, signatureNonceBurn)).to.emit(domainGateway, 'DomainBurned')
      .withArgs(
        burnInfo.source.chainId,
        burnInfo.tokenId,
        burnInfo.source.chainId,
        0,
        userAccount.address,
        ZEROA,
        mintInfo.expiry,
        domainName,
      );

    const existsBurned = await domainGateway.exists(burnInfo.tokenId);
    expect(existsBurned).to.equal(false);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(0);
  });

  it('should correctly extend domain', async () => {
    await custodianGateway.addOperator(admin.address);
    const domainName = 'test.com';
    const mintInfo = await generateInfo(custodianGateway, 'mint', domainName, ZEROA, userAccount);
    const mintCallData = encodeDomainInfoFn(domainGateway, 'mint', mintInfo, domainImplementation);

    const signatureNonceGroup = nonceGroupId(`dnt.domains.management.${mintInfo.tokenId}`);
    const signatureNonce = 100;

    const signature = await signCustodianExternalCall(admin, domainGateway, mintCallData, signatureNonceGroup, signatureNonce);

    await expect(custodianGateway.externalCallWithPermit(domainGateway.address, mintCallData, signature, signatureNonceGroup, signatureNonce))
      .to
      .emit(domainGateway, 'DomainMinted')
      .withArgs(
        mintInfo.destination.chainId,
        mintInfo.tokenId,
        0,
        mintInfo.destination.chainId,
        ZEROA,
        userAccount.address,
        mintInfo.expiry,
        'test.com',
      );

    const exists = await domainGateway.exists(mintInfo.tokenId);
    expect(exists).to.equal(true);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);

    const extendInfo = await generateInfo(custodianGateway, 'extension', domainName, userAccount, userAccount, mintInfo.expiry + 365 * 24 * 3600);
    const extendCallData = encodeDomainInfoFn(domainGateway, 'extend', extendInfo, domainImplementation);
    const signatureNonceExtend = 101;

    const signatureExtend = await signCustodianExternalCall(admin, domainGateway, extendCallData, signatureNonceGroup, signatureNonceExtend);

    await expect(custodianGateway.externalCallWithPermit(domainGateway.address, extendCallData, signatureExtend, signatureNonceGroup, signatureNonceExtend))
      .to
      .emit(domainGateway, 'DomainExtended')
      .withArgs(
        extendInfo.destination.chainId,
        extendInfo.tokenId,
        extendInfo.source.chainId,
        extendInfo.destination.chainId,
        otherAccounts[0].address,
        otherAccounts[0].address,
        extendInfo.expiry,
        domainName,
      );
  });

  it('should lock and unlock', async () => {
    await custodianGateway.addOperator(admin.address);
    const domainName = 'test.com';
    const { chainId } = await ethers.provider.getNetwork();
    const block = await ethers.provider.getBlock();
    const tokenId = encodeDomainToId(domainName);
    const mintInfo = await generateInfo(custodianGateway, 'mint', domainName, ZEROA, userAccount);
    const mintCallData = encodeDomainInfoFn(domainGateway, 'mint', mintInfo, domainImplementation);

    const signatureNonceGroup = nonceGroupId(`dnt.domains.management.${mintInfo.tokenId}`);
    const signatureNonce = 100;

    const signature = await signCustodianExternalCall(admin, domainGateway, mintCallData, signatureNonceGroup, signatureNonce);

    await expect(custodianGateway.externalCallWithPermit(domainGateway.address, mintCallData, signature, signatureNonceGroup, signatureNonce))
      .to
      .emit(domainGateway, 'DomainMinted')
      .withArgs(
        mintInfo.destination.chainId,
        mintInfo.tokenId,
        0,
        mintInfo.destination.chainId,
        ZEROA,
        userAccount.address,
        mintInfo.expiry,
        'test.com',
      );

    const exists = await domainGateway.exists(mintInfo.tokenId);
    expect(exists).to.equal(true);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);

    let domainInfo = await domainGateway.getDomainInfo(tokenId);

    expect(domainInfo.locked.gt(0)).to.equal(true);

    expect(await domainGateway.isLocked(tokenId)).to.equal(true);

    await domainGateway.connect(otherAccounts[0]).setLock(tokenId, false);
    domainInfo = await domainGateway.getDomainInfo(tokenId);

    expect(domainInfo.locked.eq(0)).to.equal(true);
  });

  it('should throw when transfering a locked token', async () => {
    await custodianGateway.addOperator(admin.address);
    const domainName = 'test.com';
    const { chainId } = await ethers.provider.getNetwork();
    const block = await ethers.provider.getBlock();
    const tokenId = encodeDomainToId(domainName);
    const mintInfo = await generateInfo(custodianGateway, 'mint', domainName, ZEROA, userAccount);
    const mintCallData = encodeDomainInfoFn(domainGateway, 'mint', mintInfo, domainImplementation);

    const signatureNonceGroup = nonceGroupId(`dnt.domains.management.${mintInfo.tokenId}`);
    const signatureNonce = 100;

    const signature = await signCustodianExternalCall(admin, domainGateway, mintCallData, signatureNonceGroup, signatureNonce);

    await expect(custodianGateway.externalCallWithPermit(domainGateway.address, mintCallData, signature, signatureNonceGroup, signatureNonce))
      .to
      .emit(domainGateway, 'DomainMinted')
      .withArgs(
        mintInfo.destination.chainId,
        mintInfo.tokenId,
        0,
        mintInfo.destination.chainId,
        ZEROA,
        userAccount.address,
        mintInfo.expiry,
        'test.com',
      );

    const exists = await domainGateway.exists(mintInfo.tokenId);
    expect(exists).to.equal(true);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);

    await expect(domainGateway.connect(otherAccounts[0]).transferFrom(otherAccounts[0].address, otherAccounts[1].address, tokenId)).revertedWith('Domain is locked');

    await domainGateway.connect(otherAccounts[0]).setLock(tokenId, false);

    await expect(domainGateway.connect(otherAccounts[0]).transferFrom(otherAccounts[0].address, otherAccounts[1].address, tokenId)).to.emit(domainGateway, 'Transfer');
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(0);
    expect(await domainGateway.balanceOf(otherAccounts[1].address)).to.equal(1);
  });

  it('should request withdraw', async () => {
    await custodianGateway.addOperator(admin.address);
    const domainName = 'test.com';
    const { chainId } = await ethers.provider.getNetwork();
    const block = await ethers.provider.getBlock();
    const tokenId = encodeDomainToId(domainName);
    const mintInfo = await generateInfo(custodianGateway, 'mint', domainName, ZEROA, userAccount);
    const mintCallData = encodeDomainInfoFn(domainGateway, 'mint', mintInfo, domainImplementation);

    const signatureNonceGroup = nonceGroupId(`dnt.domains.management.${mintInfo.tokenId}`);
    const signatureNonce = 100;

    const signature = await signCustodianExternalCall(admin, domainGateway, mintCallData, signatureNonceGroup, signatureNonce);

    await expect(custodianGateway.externalCallWithPermit(domainGateway.address, mintCallData, signature, signatureNonceGroup, signatureNonce))
      .to
      .emit(domainGateway, 'DomainMinted')
      .withArgs(
        mintInfo.destination.chainId,
        mintInfo.tokenId,
        0,
        mintInfo.destination.chainId,
        ZEROA,
        userAccount.address,
        mintInfo.expiry,
        'test.com',
      );

    const exists = await domainGateway.exists(mintInfo.tokenId);
    expect(exists).to.equal(true);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);

    await expect(domainGateway.withdraw(tokenId)).revertedWith('not owner of domain');
    await expect(domainGateway.connect(otherAccounts[0]).withdraw(tokenId)).revertedWith('Domain is locked');
    await domainGateway.connect(otherAccounts[0]).setLock(tokenId, false);
    await expect(domainGateway.connect(otherAccounts[0]).withdraw(tokenId)).to.emit(domainGateway, 'WithdrawRequest')
      .withArgs(mintInfo.destination.chainId, tokenId);
    expect(await domainGateway.isFrozen(tokenId)).to.equal(true);
  });
});
