const { ethers, waffle } = require('hardhat');
const chai = require('chai');

chai.use(waffle.solidity);
const { expect } = chai;

const flattenArray = (array) => array.reduce((r, el) => {
  if (Array.isArray(el)) {
    return r.concat(el);
  }
  r.push(el);
  return r;
}, []);

const encodeDomainToId = (domainName) => {
  const domainHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(['string'], [domainName]),
  );
  const tokenId = ethers.BigNumber.from(domainHash);
  return tokenId;
};

const messageType = (type) => {
  const x = ethers.BigNumber.from(ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(['string'], [`dnt.domain.messagetype.${type}`]),
  ));
  //  console.log(`${type} ${x}`);
  return x;
};

const hashInformation = (info) => {
  const Info = [
    info.messageType || messageType('invalid'),
    info.custodian,
    info.tokenId || encodeDomainToId(info.domainName),

    [
      info.destination.chainId || 0,
      info.destination.owner || 0,
      info.destination.blockNumber || 0,
    ],

    [
      info.source.chainId || 0,
      info.source.owner || 0,
      info.source.blockNumber || 0,
    ],

    info.nonce,
    info.domainName,
    info.expiryTime || 0,
  ];

  const encoded = ethers.utils.defaultAbiCoder.encode(
    [
      'uint256',
      'address',
      'uint256', // token id

      'uint256', // destination chain
      'address', // destination owner
      'uint256', // destination block

      'uint256', // source chain
      'address', // source owner
      'uint256', // source block

      'uint256', // Nonce
      'string', // domainName
      'uint256', // expiryTime
    ],
    flattenArray(Info),
  );

  const InfoHash = ethers.utils.keccak256(
    encoded,
  );

  return InfoHash;
};

describe('Domain', () => {
  let admin;
  let allAccounts;
  let otherAccounts;
  let userAccount;
  let AdminProxy;
  let adminProxy;
  let DomainProxy;
  let DomainImplementation;
  let CustodianImplementation;
  let CustodianProxy;
  let domainProxy;
  let domainGateway;
  let domainImplementation;
  let custodianProxy;
  let custodianImplementation;
  let custodianGateway;
  let UserImplementation;
  let UserProxy;
  let userProxy;
  let userImplementation;
  let userGateway;

  let nonce = 1000;
  const ZEROA = ethers.constants.AddressZero;
  const now = Math.floor(Date.now() / 1000);
  const generateInfo = async (
    type,
    domainName,
    sourceOwner = ZEROA,
    destinationOwner = ZEROA,
    expiry = now + 3600 * 24 * 365,
  ) => {
    const block = await ethers.provider.getBlock();
    const { chainId } = await ethers.provider.getNetwork();
    const tokenId = encodeDomainToId(domainName);

    if (type == 'mint') {
      return {
        messageType: messageType(type),
        custodian: custodianGateway.address,
        tokenId,
        destination: {
          chainId,
          owner: destinationOwner.address ? destinationOwner.address : destinationOwner,
          blockNumber: parseInt(`${block.number}`, 10) - 1,
        },
        source: {
          chainId: 0,
          owner: sourceOwner.address ? sourceOwner.address : sourceOwner,
          blockNumber: 0,
        },
        domainName,
        expiry,
      };
    } if (type == 'burn') {
      return {
        messageType: messageType(type),
        custodian: custodianGateway.address,
        tokenId,
        source: {
          chainId,
          owner: sourceOwner.address ? sourceOwner.address : sourceOwner,
          blockNumber: parseInt(`${block.number}`, 10) - 1,
        },
        destination: {
          chainId: 0,
          owner: destinationOwner.address ? destinationOwner.address : destinationOwner,
          blockNumber: 0,
        },
        domainName,
        expiry,
      };
    } if (type == 'extension') {
      return {
        messageType: messageType(type),
        custodian: custodianGateway.address,
        tokenId,

        source: {
          chainId,
          owner: sourceOwner.address ? sourceOwner.address : sourceOwner,
          blockNumber: parseInt(`${block.number}`, 10) - 1,

        },

        destination: {
          chainId,
          owner: destinationOwner.address ? destinationOwner.address : destinationOwner,
          blockNumber: parseInt(`${block.number}`, 10) - 1,

        },
        domainName,
        expiry,
      };
    }
    throw new Error('unknown info type');
  };

  before(async () => {
    allAccounts = await ethers.getSigners();
    [admin, ...otherAccounts] = allAccounts;
    userAccount = otherAccounts[0];
    DomainProxy = await ethers.getContractFactory('DomainUpgradeable');
    DomainImplementation = await ethers.getContractFactory('DomainTokenBase');
    
    CustodianProxy = await ethers.getContractFactory('CustodianUpgradeable');
    CustodianImplementation = await ethers.getContractFactory('CustodianImplementationV1');
    UserProxy = await ethers.getContractFactory('UserUpgradeable');
    UserImplementation = await ethers.getContractFactory('UserImplementationV1');
    
    AdminProxy = await ethers.getContractFactory('AdminProxy');
  });
  beforeEach(async () => {
    adminProxy = await AdminProxy.deploy();
    userImplementation = await UserImplementation.deploy();
    const userInitData = userImplementation.interface.encodeFunctionData('initialize()', []);
    userProxy = await UserProxy.deploy(userImplementation.address, adminProxy.address, userInitData);
    userGateway = userImplementation.attach(userProxy.address);
    
    custodianImplementation = await CustodianImplementation.deploy();

    const custodianInitData = custodianImplementation.interface.encodeFunctionData('initialize(string,string,address)', [
      'DNT-TEST', 'http://localhost/', userGateway.address
    ]);

    custodianProxy = await CustodianProxy.deploy(custodianImplementation.address, adminProxy.address, custodianInitData);

    custodianGateway = custodianImplementation.attach(custodianProxy.address);
    
    await userGateway.transferOwnership(custodianGateway.address);
    
    domainImplementation = await DomainImplementation.deploy();
    
    const domainInitData = domainImplementation.interface.encodeFunctionData('initialize(address,string,string,uint256)', [
      custodianProxy.address,
      'DOMAIN', 'Domains',
      (await ethers.provider.getNetwork()).chainId,
    ]);

    domainProxy = await DomainProxy.deploy(domainImplementation.address, adminProxy.address, domainInitData);

    domainGateway = domainImplementation.attach(domainProxy.address);
    
  });

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

    const mintInfo = await generateInfo('mint', domainName, ZEROA, userAccount);

    const mintCallData = domainImplementation.interface.encodeFunctionData('mint((uint256,address,uint256,(uint256,address,uint256),(uint256,address,uint256),string,uint256))', [[mintInfo.messageType,mintInfo.custodian,mintInfo.tokenId,[mintInfo.destination.chainId, mintInfo.destination.owner, mintInfo.destination.blockNumber],[mintInfo.source.chainId, mintInfo.source.owner, mintInfo.source.blockNumber],mintInfo.domainName, mintInfo.expiry]]);
    console.log(mintCallData);
    const signatureNonceGroup = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string'], [`dnt.custodian.domains.manage.${mintInfo.tokenId}`]));
    const signatureNonce = 100;
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(['address' , 'bytes', 'bytes32', 'uint256'],
                                          [ domainGateway.address, mintCallData, signatureNonceGroup, signatureNonce ]),
    );

    const signature = await admin.signMessage(ethers.utils.arrayify(hash));
    console.log(signature);
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
    const mintInfo = await generateInfo('mint', domainName, ZEROA, userAccount);

    const mintInfoSignature = await admin.signMessage(ethers.utils.arrayify(hashInformation(mintInfo)));

    await expect(domainGateway.mint(mintInfo, mintInfoSignature)).to.emit(domainGateway, 'DomainMinted')
      .withArgs(
        mintInfo.destination.chainId,
        mintInfo.tokenId,
        0,
        mintInfo.destination.chainId,
        ZEROA,
        userAccount.address,
        mintInfo.expiryTime,
        mintInfo.withdrawLocktime,
        'test.com',
      );

    const exists = await domainGateway.exists(mintInfo.tokenId);
    expect(exists).to.equal(true);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);

    await domainGateway.connect(otherAccounts[0]).setLock(mintInfo.tokenId, false);

    const burnInfo = await generateInfo('burn', domainName, userAccount.address, ZEROA);

    const burnInfoSignature = await admin.signMessage(ethers.utils.arrayify(hashInformation(burnInfo)));

    await expect(domainGateway.burn(burnInfo, burnInfoSignature)).to.emit(domainGateway, 'DomainBurned')
      .withArgs(
        burnInfo.source.chainId,
        burnInfo.tokenId,
        burnInfo.source.chainId,
        0,
        userAccount.address,
        ZEROA,
        mintInfo.expiryTime,
        mintInfo.withdrawLocktime,
        domainName,
      );

    const existsBurned = await domainGateway.exists(burnInfo.tokenId);
    expect(existsBurned).to.equal(false);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(0);
  });

  it('should correctly forcefully burn', async () => {
    await custodianGateway.addOperator(admin.address);
    const domainName = 'test.com';
    const mintInfo = await generateInfo('mint', domainName, ZEROA, userAccount);

    const mintInfoSignature = await admin.signMessage(ethers.utils.arrayify(hashInformation(mintInfo)));

    await expect(domainGateway.mint(mintInfo, mintInfoSignature)).to.emit(domainGateway, 'DomainMinted')
      .withArgs(
        mintInfo.destination.chainId,
        mintInfo.tokenId,
        0,
        mintInfo.destination.chainId,
        ZEROA,
        userAccount.address,
        mintInfo.expiryTime,
        mintInfo.withdrawLocktime,
        'test.com',
      );

    const exists = await domainGateway.exists(mintInfo.tokenId);
    expect(exists).to.equal(true);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);
    await expect(domainGateway.forceBurn(mintInfo.tokenId)).to.emit(domainGateway, 'DomainBurned')
      .withArgs(
        mintInfo.destination.chainId,
        mintInfo.tokenId,
        mintInfo.destination.chainId,
        0,
        userAccount.address,
        ZEROA,
        mintInfo.expiryTime,
        mintInfo.withdrawLocktime,
        domainName,
      );

    const existsBurned = await domainGateway.exists(mintInfo.tokenId);
    expect(existsBurned).to.equal(false);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(0);
  });

  it('should correctly extend domain', async () => {
    await custodianGateway.addOperator(admin.address);
    const domainName = 'test.com';

    const mintInfo = await generateInfo('mint', domainName, ZEROA, userAccount);
    const mintInfoSignature = await admin.signMessage(ethers.utils.arrayify(hashInformation(mintInfo)));

    await expect(domainGateway.mint(mintInfo, mintInfoSignature)).to.emit(domainGateway, 'DomainMinted')
      .withArgs(
        mintInfo.destination.chainId,
        mintInfo.tokenId,
        0,
        mintInfo.destination.chainId,
        ethers.constants.AddressZero,
        otherAccounts[0].address,
        mintInfo.expiryTime,
        mintInfo.withdrawLocktime,
        domainName,
      );

    const exists = await domainGateway.exists(mintInfo.tokenId);
    expect(exists).to.equal(true);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);

    const extendInfo = await generateInfo('extension', domainName, userAccount, userAccount, mintInfo.expiryTime + 365 * 24 * 3600);

    const extensionInfoSignature = await admin.signMessage(ethers.utils.arrayify(hashInformation(extendInfo)));

    await expect(domainGateway.extend(extendInfo, extensionInfoSignature)).to.emit(domainGateway, 'DomainExtended')
      .withArgs(
        extendInfo.destination.chainId,
        extendInfo.tokenId,
        extendInfo.source.chainId,
        extendInfo.destination.chainId,
        otherAccounts[0].address,
        otherAccounts[0].address,
        extendInfo.expiryTime,
        extendInfo.withdrawLocktime,
        domainName,
      );
  });

  it('should lock and unlock', async () => {
    await custodianGateway.addOperator(admin.address);
    const domainName = 'test.com';
    const { chainId } = await ethers.provider.getNetwork();
    const block = await ethers.provider.getBlock();
    const tokenId = encodeDomainToId(domainName);

    const mintInfo = await generateInfo('mint', domainName, ZEROA, userAccount);
    const mintInfoSignature = await admin.signMessage(ethers.utils.arrayify(hashInformation(mintInfo)));

    await expect(domainGateway.mint(mintInfo, mintInfoSignature)).to.emit(domainGateway, 'DomainMinted')
      .withArgs(
        chainId,
        tokenId,
        0,
        chainId,
        ethers.constants.AddressZero,
        otherAccounts[0].address,
        mintInfo.expiryTime,
        mintInfo.withdrawLocktime,
        'test.com',
      );

    const exists = await domainGateway.exists(tokenId);
    expect(exists).to.equal(true);

    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);

    let domainInfo = await domainGateway.getDomainInfo(tokenId);

    expect(domainInfo.lockTime.gt(0)).to.equal(true);

    expect(await domainGateway.isLocked(tokenId)).to.equal(true);

    await domainGateway.connect(otherAccounts[0]).setLock(tokenId, false);
    domainInfo = await domainGateway.getDomainInfo(tokenId);

    expect(domainInfo.lockTime.eq(0)).to.equal(true);
  });

  it('should throw when transfering a locked token', async () => {
    await custodianGateway.addOperator(admin.address);
    const domainName = 'test.com';
    const { chainId } = await ethers.provider.getNetwork();
    const block = await ethers.provider.getBlock();
    const tokenId = encodeDomainToId(domainName);

    const mintInfo = await generateInfo('mint', domainName, ZEROA, userAccount);
    const mintInfoSignature = await admin.signMessage(ethers.utils.arrayify(hashInformation(mintInfo)));

    await expect(domainGateway.mint(mintInfo, mintInfoSignature)).to.emit(domainGateway, 'DomainMinted')
      .withArgs(
        chainId,
        tokenId,
        0,
        chainId,
        ethers.constants.AddressZero,
        otherAccounts[0].address,
        mintInfo.expiryTime,
        mintInfo.withdrawLocktime,
        'test.com',
      );

    const exists = await domainGateway.exists(tokenId);
    expect(exists).to.equal(true);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);

    await expect(domainGateway.connect(otherAccounts[0]).transferFrom(otherAccounts[0].address, otherAccounts[1].address, tokenId)).revertedWith('Domain is locked');

    await domainGateway.connect(otherAccounts[0]).setLock(tokenId, false);

    await expect(domainGateway.connect(otherAccounts[0]).transferFrom(otherAccounts[0].address, otherAccounts[1].address, tokenId)).to.emit(domainGateway, 'Transfer');
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(0);
    expect(await domainGateway.balanceOf(otherAccounts[1].address)).to.equal(1);
  });

  it('should throw when withdrawing a domain before withdrawLocktime', async () => {
    await custodianGateway.addOperator(admin.address);
    const domainName = 'test.com';
    const { chainId } = await ethers.provider.getNetwork();
    const block = await ethers.provider.getBlock();
    const tokenId = encodeDomainToId(domainName);

    const mintInfo = await generateInfo('mint', domainName, ZEROA, userAccount);
    const mintInfoSignature = await admin.signMessage(ethers.utils.arrayify(hashInformation(mintInfo)));

    await expect(domainGateway.mint(mintInfo, mintInfoSignature)).to.emit(domainGateway, 'DomainMinted')
      .withArgs(
        chainId,
        tokenId,
        0,
        chainId,
        ethers.constants.AddressZero,
        otherAccounts[0].address,
        mintInfo.expiryTime,
        mintInfo.withdrawLocktime,
        'test.com',
      );

    const exists = await domainGateway.exists(tokenId);
    expect(exists).to.equal(true);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);

    await expect(domainGateway.connect(otherAccounts[0]).requestWithdraw(tokenId)).revertedWith('not active user');

    await custodianGateway.registerUser(otherAccounts[0].address);

    await custodianGateway.activateUser(otherAccounts[0].address);

    await expect(domainGateway.connect(otherAccounts[0]).requestWithdraw(tokenId)).revertedWith('Domain is locked');

    await domainGateway.connect(otherAccounts[0]).setLock(tokenId, false);

    await expect(domainGateway.connect(otherAccounts[0]).requestWithdraw(tokenId)).revertedWith('can not initiate withdraw');
  });

  it('should withdraw a domain', async () => {
    await custodianGateway.addOperator(admin.address);
    const domainName = 'test.com';
    const { chainId } = await ethers.provider.getNetwork();
    const block = await ethers.provider.getBlock();
    const tokenId = encodeDomainToId(domainName);
    const mintInfo = await generateInfo('mint', domainName, ZEROA, userAccount, now + 1 * 365 * 24 * 3600, 0);
    const mintInfoSignature = await admin.signMessage(ethers.utils.arrayify(hashInformation(mintInfo)));

    await expect(domainGateway.mint(mintInfo, mintInfoSignature)).to.emit(domainGateway, 'DomainMinted')
      .withArgs(
        chainId,
        tokenId,
        0,
        chainId,
        ethers.constants.AddressZero,
        otherAccounts[0].address,
        mintInfo.expiryTime,
        mintInfo.withdrawLocktime,
        'test.com',
      );

    const exists = await domainGateway.exists(tokenId);
    expect(exists).to.equal(true);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);
    await expect(domainGateway.connect(otherAccounts[0]).requestWithdraw(tokenId)).revertedWith('not active user');

    await custodianGateway.registerUser(otherAccounts[0].address);
    await custodianGateway.activateUser(otherAccounts[0].address);

    await expect(domainGateway.connect(otherAccounts[0]).requestWithdraw(tokenId)).revertedWith('Domain is locked');

    await domainGateway.connect(otherAccounts[0]).setLock(tokenId, false);

    await expect(domainGateway.connect(otherAccounts[0]).requestWithdraw(tokenId)).to.emit(domainGateway, 'WithdrawRequest')
      .withArgs(
        chainId,
        tokenId,
        otherAccounts[0].address,
      );
    expect(await domainGateway.isWithdrawing(tokenId)).to.equal(true);
    await expect(domainGateway.fulfillWithdraw(tokenId)).to.emit(domainGateway, 'WithdrawFulfilled')
      .withArgs(
        chainId,
        tokenId,
        'test.com',
      );
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(0);
    expect(await domainGateway.exists(tokenId)).to.equal(false);
  });
  it('should cancel a domain withdraw', async () => {
    await custodianGateway.addOperator(admin.address);
    const domainName = 'test.com';
    const { chainId } = await ethers.provider.getNetwork();
    const block = await ethers.provider.getBlock();
    const tokenId = encodeDomainToId(domainName);
    const now = Math.floor(Date.now() / 1000);
    const mintInfo = await generateInfo('mint', domainName, ZEROA, userAccount, now + 1 * 365 * 24 * 3600, 0);
    const mintInfoSignature = await admin.signMessage(ethers.utils.arrayify(hashInformation(mintInfo)));

    await expect(domainGateway.mint(mintInfo, mintInfoSignature)).to.emit(domainGateway, 'DomainMinted')
      .withArgs(
        chainId,
        tokenId,
        0,
        chainId,
        ethers.constants.AddressZero,
        otherAccounts[0].address,
        mintInfo.expiryTime,
        mintInfo.withdrawLocktime,
        'test.com',
      );

    const exists = await domainGateway.exists(tokenId);
    expect(exists).to.equal(true);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);
    await expect(domainGateway.connect(otherAccounts[0]).requestWithdraw(tokenId)).revertedWith('not active user');

    await custodianGateway.registerUser(otherAccounts[0].address);
    await custodianGateway.activateUser(otherAccounts[0].address);

    await expect(domainGateway.connect(otherAccounts[0]).requestWithdraw(tokenId)).revertedWith('Domain is locked');

    await domainGateway.connect(otherAccounts[0]).setLock(tokenId, false);

    await expect(domainGateway.connect(otherAccounts[0]).requestWithdraw(tokenId)).to.emit(domainGateway, 'WithdrawRequest')
      .withArgs(
        chainId,
        tokenId,
        otherAccounts[0].address,
      );
    await expect(domainGateway.cancelWithdrawRequest(tokenId)).to.emit(domainGateway, 'WithdrawCancel')
      .withArgs(
        chainId,
        tokenId,
      );
    expect(await domainGateway.isWithdrawing(tokenId)).to.equal(false);
  });
});
