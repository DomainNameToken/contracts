
const { ethers, waffle } = require('hardhat');
const chai = require('chai');

chai.use(waffle.solidity);
const { expect } = chai;

const flattenArray = (array) => {
  return array.reduce((r, el)=>{
    if(Array.isArray(el)){
      return r.concat(el);
    }
    r.push(el);
    return r;
  }, []);
};

const encodeDomainToId = (domainName) => {
  const domainHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(['string'], [domainName]),
  );
  const tokenId = ethers.BigNumber.from(domainHash);
  return tokenId;
};

const messageType = (type) => {
  const x = ethers.BigNumber.from(ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(['string'], [`dnt.domain.messagetype.${type}`])
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
      info.destination.blockNumberTTL || 0
    ],
      
      
    [
      info.source.chainId || 0,
      info.source.owner || 0,
      info.source.blockNumber || 0,
      info.source.blockNumberTTL || 0,
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
        'address',  // destination owner
        'uint256',  // destination block
        'uint256', // destination ttl
        
        
        'uint256', // source chain
        'address', // source owner
        'uint256', // source block
        'uint256', // source ttl
        
        'uint256', // Nonce
        'string', // domainName
        'uint256', // expiryTime
      ],
      flattenArray(Info)
    );
  
    const InfoHash = ethers.utils.keccak256(
      encoded
    );

  return InfoHash;
  
}

describe('Domain', () => {
  let admin;
  let allAccounts;
  let otherAccounts;
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
  before(async () => {
    allAccounts = await ethers.getSigners();
    [admin, ...otherAccounts] = allAccounts;
    DomainProxy = await ethers.getContractFactory('DomainUpgradeable');
    DomainImplementation = await ethers.getContractFactory('DomainTokenBase');
    
    CustodianProxy = await ethers.getContractFactory('CustodianUpgradeable');
    CustodianImplementation = await ethers.getContractFactory('CustodianImplementationV1');

    AdminProxy = await ethers.getContractFactory('AdminProxy');
    
  });
  beforeEach(async () => {

    adminProxy = await AdminProxy.deploy();
    

    custodianImplementation = await CustodianImplementation.deploy();

    const custodianInitData = custodianImplementation.interface.encodeFunctionData('initialize(string,string)', [
      'DNT-TEST', 'http://localhost/'
    ]);

    custodianProxy = await CustodianProxy.deploy(custodianImplementation.address, adminProxy.address, custodianInitData);
    
    custodianGateway = custodianImplementation.attach(custodianProxy.address);
    
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
    const { chainId } = await ethers.provider.getNetwork();
    const block = await ethers.provider.getBlock();
    const tokenId = encodeDomainToId(domainName);

    
    
    const mintInfo = {
      messageType: messageType('mint'),
      custodian: custodianGateway.address,
      tokenId: tokenId,
      
      destination: {
        chainId,
        owner: otherAccounts[0].address,
        blockNumber: parseInt(`${block.number}`, 10)-1,
        blockNumberTTL: 15
      },
      
      
      source: {
        chainId: 0,
        owner: ethers.constants.AddressZero,
        blockNumber: 0,
        blockNumberTTL: 0
      },
      
      
      nonce: 1001,
      domainName,
      expiryTime: Math.floor(Date.now()/1000)+3600*24*365
    };

    

    const mintInfoSignature = await admin.signMessage(ethers.utils.arrayify(hashInformation(mintInfo)));

    await expect(domainGateway.mint(mintInfo, mintInfoSignature)).to.emit(domainGateway, 'DomainMinted')
      .withArgs(
        chainId, tokenId, 0, chainId, ethers.constants.AddressZero, otherAccounts[0].address,
        mintInfo.expiryTime,
        'test.com'
      );

    const exists = await domainGateway.exists(tokenId);
    expect(exists).to.equal(true);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);
  });

  it('should correctly burn', async () => {

    await custodianGateway.addOperator(admin.address);
    const domainName = 'test.com';    
    const { chainId } = await ethers.provider.getNetwork();
    const block = await ethers.provider.getBlock();
    const tokenId = encodeDomainToId(domainName);
    
    
    const mintInfo = {
      messageType: messageType('mint'),
      custodian: custodianGateway.address,
      tokenId: tokenId,
      
      destination: {
        chainId,
        owner: otherAccounts[0].address,
        blockNumber: parseInt(`${block.number}`, 10)-1,
        blockNumberTTL: 15
      },
      
      
      source: {
        chainId: 0,
        owner: ethers.constants.AddressZero,
        blockNumber: 0,
        blockNumberTTL: 0
      },
      
      
      nonce: 1001,
      domainName,
      expiryTime: Math.floor(Date.now()/1000)+3600*24*365
    };
    const mintInfoSignature = await admin.signMessage(ethers.utils.arrayify(hashInformation(mintInfo)));

    await expect(domainGateway.mint(mintInfo, mintInfoSignature)).to.emit(domainGateway, 'DomainMinted')
      .withArgs(
        chainId, tokenId, 0, chainId, ethers.constants.AddressZero, otherAccounts[0].address,
        mintInfo.expiryTime,
        'test.com'
      );

    const exists = await domainGateway.exists(tokenId);
    expect(exists).to.equal(true);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);



    await domainGateway.connect(otherAccounts[0]).setLock(tokenId, false);

    const burnInfo =
          {
            messageType: messageType('burn'),
            custodian: custodianGateway.address,
            tokenId: tokenId,
            
            source: {
              chainId,
              owner: otherAccounts[0].address,
              blockNumber: parseInt(`${block.number}`, 10)-1,
              blockNumberTTL: 15
            },
            
            
            destination: {
              chainId: 0,
              owner: ethers.constants.AddressZero,
              blockNumber: 0,
              blockNumberTTL: 0
            },
            
            
            nonce: 1002,
            domainName,
            expiryTime: mintInfo.expiryTime
          };
    const burnInfoSignature = await admin.signMessage(ethers.utils.arrayify(hashInformation(burnInfo)));

    await expect(domainGateway.burn(burnInfo, burnInfoSignature)).to.emit(domainGateway, 'DomainBurned')
      .withArgs(
        chainId, tokenId, chainId, 0, otherAccounts[0].address,  ethers.constants.AddressZero,
        burnInfo.expiryTime,
        'test.com'
      );

    const existsBurned = await domainGateway.exists(tokenId);
    expect(existsBurned).to.equal(false);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(0);

    
    
    
  });

  it('should correctly extend domain', async () => {

    await custodianGateway.addOperator(admin.address);
    const domainName = 'test.com';    
    const { chainId } = await ethers.provider.getNetwork();
    const block = await ethers.provider.getBlock();
    const tokenId = encodeDomainToId(domainName);
    
    
    const mintInfo = {
      messageType: messageType('mint'),
      custodian: custodianGateway.address,
      tokenId: tokenId,
      
      destination: {
        chainId,
        owner: otherAccounts[0].address,
        blockNumber: parseInt(`${block.number}`, 10)-1,
        blockNumberTTL: 15
      },
      
      
      source: {
        chainId: 0,
        owner: ethers.constants.AddressZero,
        blockNumber: 0,
        blockNumberTTL: 0
      },
      
      
      nonce: 1001,
      domainName,
      expiryTime: Math.floor(Date.now()/1000)+3600*24*365
    };
    const mintInfoSignature = await admin.signMessage(ethers.utils.arrayify(hashInformation(mintInfo)));

    await expect(domainGateway.mint(mintInfo, mintInfoSignature)).to.emit(domainGateway, 'DomainMinted')
      .withArgs(
        chainId, tokenId, 0, chainId, ethers.constants.AddressZero, otherAccounts[0].address,
        mintInfo.expiryTime,
        'test.com'
      );

    const exists = await domainGateway.exists(tokenId);
    expect(exists).to.equal(true);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);





    const extendInfo =
          {
            messageType: messageType('extension'),
            custodian: custodianGateway.address,
            tokenId: tokenId,
            
            source: {
              chainId,
              owner: otherAccounts[0].address,
              blockNumber: parseInt(`${block.number}`, 10)-1,
              blockNumberTTL: 15
            },
            
            
            destination: {
              chainId,
              owner: otherAccounts[0].address,
              blockNumber: parseInt(`${block.number}`, 10)-1,
              blockNumberTTL: 15
            },
            
            
            nonce: 1002,
            domainName,
            expiryTime: mintInfo.expiryTime + 365 * 24 * 3600
          };

    const extensionInfoSignature = await admin.signMessage(ethers.utils.arrayify(hashInformation(extendInfo)));

    await expect(domainGateway.extend(extendInfo, extensionInfoSignature)).to.emit(domainGateway, 'DomainExtended')
      .withArgs(
        chainId, tokenId, chainId, chainId, otherAccounts[0].address,  otherAccounts[0].address,
        extendInfo.expiryTime,
        'test.com'
      );

    
    
    
    
  });
  
  
  it('should lock and unlock', async () => {
    await custodianGateway.addOperator(admin.address);
    const domainName = 'test.com';    
    const { chainId } = await ethers.provider.getNetwork();
    const block = await ethers.provider.getBlock();
    const tokenId = encodeDomainToId(domainName);
    
    
    const mintInfo = {
      messageType: messageType('mint'),
      custodian: custodianGateway.address,
      tokenId: tokenId,
      
      destination: {
        chainId,
        owner: otherAccounts[0].address,
        blockNumber: parseInt(`${block.number}`, 10)-1,
        blockNumberTTL: 15
      },
      
      
      source: {
        chainId: 0,
        owner: ethers.constants.AddressZero,
        blockNumber: 0,
        blockNumberTTL: 0
      },
      
      
      nonce: 1001,
      domainName,
      expiryTime: Math.floor(Date.now()/1000)+3600*24*365
    };
    const mintInfoSignature = await admin.signMessage(ethers.utils.arrayify(hashInformation(mintInfo)));
    
    await expect(domainGateway.mint(mintInfo, mintInfoSignature)).to.emit(domainGateway, 'DomainMinted')
      .withArgs(
        chainId, tokenId, 0, chainId, ethers.constants.AddressZero, otherAccounts[0].address,
        mintInfo.expiryTime,
        'test.com'
      );
    
    const exists = await domainGateway.exists(tokenId);
    expect(exists).to.equal(true);
    
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);

    let domainInfo = await domainGateway.getDomainInfo(tokenId);

    
    expect(domainInfo.lockTime.gt(0)).to.equal(true);
    
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
    
    
    const mintInfo = {
      messageType: messageType('mint'),
      custodian: custodianGateway.address,
      tokenId: tokenId,
      
      destination: {
        chainId,
        owner: otherAccounts[0].address,
        blockNumber: parseInt(`${block.number}`, 10)-1,
        blockNumberTTL: 15
      },
      
      
      source: {
        chainId: 0,
        owner: ethers.constants.AddressZero,
        blockNumber: 0,
        blockNumberTTL: 0
      },
      
      
      nonce: 1001,
      domainName,
      expiryTime: Math.floor(Date.now()/1000)+3600*24*365
    };
    const mintInfoSignature = await admin.signMessage(ethers.utils.arrayify(hashInformation(mintInfo)));
    
    await expect(domainGateway.mint(mintInfo, mintInfoSignature)).to.emit(domainGateway, 'DomainMinted')
      .withArgs(
        chainId, tokenId, 0, chainId, ethers.constants.AddressZero, otherAccounts[0].address,
        mintInfo.expiryTime,
        'test.com'
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
});
