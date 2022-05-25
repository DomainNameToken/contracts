
const { ethers, waffle } = require('hardhat');
const chai = require('chai');

chai.use(waffle.solidity);
const { expect } = chai;

describe('User', () => {
  let admin;
  let allAccounts;
  let otherAccounts;
  let AdminProxy;
  let adminProxy;
  let UserImplementation;
  let UserProxy;
  let userProxy;
  let userImplementation;
  let userGateway;
  before(async () => {
    allAccounts = await ethers.getSigners();
    [admin, ...otherAccounts] = allAccounts;
    
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
    
    
    
  });

  it('should correctly deploy', async () => {
    const _usersDbStartTime = await userGateway._usersDbStartTime();
    expect(_usersDbStartTime.gt(0)).to.equal(true);
  });

  
  it('should correctly register user', async () => {
    await expect(userGateway.registerUser(otherAccounts[0].address)).to.emit(userGateway, 'UserRegistered')
      .withArgs(otherAccounts[0].address);
    expect(await userGateway.isRegisteredUser(otherAccounts[0].address)).to.equal(true);
    
    
  });

    it('should correctly activate user', async () => {

    await userGateway.registerUser(otherAccounts[0].address);
    expect(await userGateway.isRegisteredUser(otherAccounts[0].address)).to.equal(true);

      await userGateway.activateUser(otherAccounts[0].address);
      expect(await userGateway.isActiveUser(otherAccounts[0].address)).to.equal(true);
    
    
  });

  it('should correctly deactivate user', async () => {


    await userGateway.registerUser(otherAccounts[0].address);
    expect(await userGateway.isRegisteredUser(otherAccounts[0].address)).to.equal(true);

    await expect(userGateway.activateUser(otherAccounts[0].address)).to.emit(userGateway, 'UserActivated')
      .withArgs(otherAccounts[0].address);
    expect(await userGateway.isActiveUser(otherAccounts[0].address)).to.equal(true);

    await expect(userGateway.deactivateUser(otherAccounts[0].address)).to.emit(userGateway, 'UserDeactivated')
      .withArgs(otherAccounts[0].address);
    expect(await userGateway.isActiveUser(otherAccounts[0].address)).to.equal(false);
    
  });


  
  it('should correctly deregister user', async () => {


    await userGateway.registerUser(otherAccounts[0].address);
    expect(await userGateway.isRegisteredUser(otherAccounts[0].address)).to.equal(true);

    await userGateway.activateUser(otherAccounts[0].address);
    expect(await userGateway.isActiveUser(otherAccounts[0].address)).to.equal(true);

    await expect(userGateway.deregisterUser(otherAccounts[0].address)).to.emit(userGateway, 'UserDeregistered')
      .withArgs(otherAccounts[0].address);
    expect(await userGateway.isActiveUser(otherAccounts[0].address)).to.equal(false);
    
  });
  
});
