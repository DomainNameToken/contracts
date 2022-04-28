
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
    
    const domainHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(['string'], ['test.com']),
    );
    const { chainId } = await ethers.provider.getNetwork();
    const block = await ethers.provider.getBlock();
    const tokenId =       ethers.BigNumber.from(domainHash);

    
    
    const mintInfo = [
      tokenId,
      
        [chainId,
        otherAccounts[0].address,
        parseInt(`${block.number}`, 10)-1,
      15],
      
      
        [0,
        ethers.constants.AddressZero,
        0,
      0],
      
      
      1001,
      'test.com',
      Math.floor(Date.now()/1000)+3600*24*365
    ];

    const mintInfoFlattened = flattenArray(mintInfo);
    
    const encoded = ethers.utils.defaultAbiCoder.encode(
      [
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
      ], mintInfoFlattened);

    const mintInfoHash = ethers.utils.keccak256(
      encoded
      
    );


    const mintInfoSignature = await admin.signMessage(ethers.utils.arrayify(mintInfoHash));

    await expect(domainGateway.mint(mintInfo, mintInfoSignature)).to.emit(domainGateway, 'DomainMinted')
      .withArgs(
        chainId, tokenId, 0, chainId, ethers.constants.AddressZero, otherAccounts[0].address, 'test.com'
      );

    const exists = await domainGateway.exists(tokenId);
    expect(exists).to.equal(true);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);
  });

  it('should correctly burn', async () => {

        await custodianGateway.addOperator(admin.address);
    
    const domainHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(['string'], ['test.com']),
    );
    const { chainId } = await ethers.provider.getNetwork();
    const block = await ethers.provider.getBlock();
    const tokenId =       ethers.BigNumber.from(domainHash);

    
    
    const mintInfo = [
      tokenId,
      
        [chainId,
        otherAccounts[0].address,
        parseInt(`${block.number}`, 10)-1,
      15],
      
      
        [0,
        ethers.constants.AddressZero,
        0,
      0],
      
      
      1001,
      'test.com',
      Math.floor(Date.now()/1000)+3600*24*365
    ];

    const mintInfoFlattened = flattenArray(mintInfo);
    
    const encoded = ethers.utils.defaultAbiCoder.encode(
      [
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
      ], mintInfoFlattened);

    const mintInfoHash = ethers.utils.keccak256(
      encoded
      
    );


    const mintInfoSignature = await admin.signMessage(ethers.utils.arrayify(mintInfoHash));

    await expect(domainGateway.mint(mintInfo, mintInfoSignature)).to.emit(domainGateway, 'DomainMinted')
      .withArgs(
        chainId, tokenId, 0, chainId, ethers.constants.AddressZero, otherAccounts[0].address, 'test.com'
      );

    const exists = await domainGateway.exists(tokenId);
    expect(exists).to.equal(true);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(1);



    await domainGateway.connect(otherAccounts[0]).setLock(tokenId, false);

    

    const burnInfo = [
      tokenId,


      
        [0,
        ethers.constants.AddressZero,
        0,
         0],
      
      [chainId,
        otherAccounts[0].address,
        parseInt(`${block.number}`, 10)-1,
      15],
      
      
      
      
      1002,
      'test.com',
      Math.floor(Date.now()/1000)+3600*24*365
    ];

    const burnInfoFlattened = flattenArray(burnInfo);
    
    const encodedBurned = ethers.utils.defaultAbiCoder.encode(
      [
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
      ], burnInfoFlattened);

    const burnInfoHash = ethers.utils.keccak256(
      encodedBurned
      
    );


    const burnInfoSignature = await admin.signMessage(ethers.utils.arrayify(burnInfoHash));

    await expect(domainGateway.burn(burnInfo, burnInfoSignature)).to.emit(domainGateway, 'DomainBurned')
      .withArgs(
        chainId, tokenId, chainId, 0, otherAccounts[0].address,  ethers.constants.AddressZero, 'test.com'
      );

    const existsBurned = await domainGateway.exists(tokenId);
    expect(existsBurned).to.equal(false);
    expect(await domainGateway.balanceOf(otherAccounts[0].address)).to.equal(0);

    
    
    
  });
  
  
});
