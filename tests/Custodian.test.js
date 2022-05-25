
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
  let CustodianProxy;
  let custodianProxy;
  let custodianImplementation;
  let custodianGateway;

  before(async () => {
    allAccounts = await ethers.getSigners();
    [admin, ...otherAccounts] = allAccounts;
    
    CustodianProxy = await ethers.getContractFactory('CustodianUpgradeable');
    CustodianImplementation = await ethers.getContractFactory('CustodianImplementationV1');

    AdminProxy = await ethers.getContractFactory('AdminProxy');
    
  });
  beforeEach(async () => {
    
    adminProxy = await AdminProxy.deploy();

    
    
    custodianImplementation = await CustodianImplementation.deploy();

    const custodianInitData = custodianImplementation.interface.encodeFunctionData('initialize(string,string)', [
      'DNT-TEST', 'http://localhost/',
    ]);

    custodianProxy = await CustodianProxy.deploy(custodianImplementation.address, adminProxy.address, custodianInitData);
    
    custodianGateway = custodianImplementation.attach(custodianProxy.address);
    
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
    let isOperator1 = await custodianGateway.isOperator(admin.address);
    let isOperator2 = await custodianGateway.isOperator(otherAccounts[0].address);
    let isOperator3 = await custodianGateway.isOperator(otherAccounts[1].address);
    expect(isOperator1).to.equal(true);
    expect(isOperator2).to.equal(true);
    expect(isOperator3).to.equal(true);

  });
  

  it('should correctly remove operator', async () => {

    await custodianGateway.addOperator(admin.address);
    await custodianGateway.addOperator(otherAccounts[0].address);
    await custodianGateway.addOperator(otherAccounts[1].address);
    let isOperator1 = await custodianGateway.isOperator(admin.address);
    let isOperator2 = await custodianGateway.isOperator(otherAccounts[0].address);
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
      100
      ],
    );
    const signature = await admin.signMessage(ethers.utils.arrayify(messageHash));
    const isValid = await custodianGateway.checkSignature(messageHash, signature);
    expect(isValid).to.equal(true);

    const signatureNotOperator = await otherAccounts[0].signMessage(ethers.utils.arrayify(messageHash));

    const isInValid = await custodianGateway.checkSignature(messageHash, signatureNotOperator);
    expect(isInValid).to.equal(false);

  });

  it.skip('should call external contract', async () => {
   /*
      const registerUserData = userImplementation.interface.encodeFunctionData('registerUser(address)', [ otherAccounts[0].address ]);
    await custodianGateway.addOperator(admin.address);
    
    await expect(custodianGateway.externalCall(userGateway.address, registerUserData))
      .to.emit(userGateway, 'UserRegistered').withArgs(otherAccounts[0].address);
   
*/
  });

  it.skip('should call external contract with permit', async () => {
    /*
      const registerUserData = userImplementation.interface.encodeFunctionData('registerUser(address)', [ otherAccounts[0].address ]);
    const signatureNonceGroup = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string'], ['dnt.custodian.operators.manage']));
    const signatureNonce = 100;
    
    await custodianGateway.addOperator(admin.address);
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(['address' , 'bytes', 'bytes32', 'uint256'],
                                          [ userGateway.address, registerUserData, signatureNonceGroup, signatureNonce ]),
    );
    const signature = await admin.signMessage(ethers.utils.arrayify(hash));
    await expect(custodianGateway.externalCallWithPermit(userGateway.address, registerUserData, signature, signatureNonceGroup, signatureNonce))
      .to
      .emit(userGateway, 'UserRegistered')
      .withArgs(otherAccounts[0].address);
    
*/
  });

  
  
});
