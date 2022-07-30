# Acquisition Manager Order Request Example

## Needed tools

- [ethers library](https://www.npmjs.com/package/ethers) - [docs](https://docs.ethers.io/v5/)
- [openpgp library](https://www.npmjs.com/package/openpgp) - [docs](https://docs.openpgpjs.org/)

## How to

### Instantiate a contract using ethers

To interact with a contract we can use `ethers`. We will need the contract address, the [ABI](https://docs.soliditylang.org/en/latest/abi-spec.html) of the contract and a signer.

```javascript
const { ethers } = require('ethers');

const signer;
// ... create a provider and a signer

const custodian = new ethers.Contract(custodianAddress, custodianAbi, signerOrProvider); // as we will only use custodian for reading data we do not need a signer
const acquisitionManager = new ethers.Contract(acquisitionManagerAddress, acquisitionManagerAbi, signer);
// acquisitionManager now contains all functions defined in ABI and can be used to interact with the contract. All on chain interactions will be signed by signer 
```

## Flow

### Register new domain

```javascript
const domainName = 'example.com';
```

- Check `domainName` availability through [DNT api](https://dntapi.com/_api-docs/#/DomainSearch/domainSearchSingle)

If `domainName` is available we can proceed with registration request to `AcquisitionManager` contract

See [order data format](./order-data-format.md)
```javascript
const openpgp = require('openpgp');

// we are calling a view function, which doesn't produce a transaction
const custodianPgpPublicKey = await custodian.pgpPublicKey();

const publicKey = await openpgp.readKey({ armoredKey: custodianPgpPublicKey });

const years = 1;

// orderInfo should be a JSON that contain
const orderInfoData = JSON.stringify({ domainName, years });

const encryptedInfoData = await openpgp.encrypt({
  message: await openpgp.createMessage({ text: orderInfoData }),
  encryptionKeys: publicKey,
});

```

Compile token id from domainName

```javascript

const domainHash = ethers.utils.keccak256(
  ethers.utils.defaultAbiCoder.encode(['string'], [domainName])
);

const tokenId = ethers.BigNumber.from(domainHash);

```

Before anything else, because signer will make on chain transactions, it has to have Matic to pay for gas.
One can receive Testnet Polygon Mumbai matic from different faucets. You can join [Polygon Discord](https://discord.gg/PerUYsnDtV) and use channel `#matic-faucet` to request some mumbai matic with `faucet-mumbai ACCOUNT_ADDRESS 5`

Let's check signer address matic balance

```javascript
const maticBalance = await signer.getBalance();

if(!maticBalance.gt(0)){
   throw new Error('Get some Matic');
}
```

Let's suppose we will be using an ERC20 token (like USDC),
which is accepted by AcquisitionManager contract, to pay for the order

```javascript

const [paymentTokenAddress] = await acquisitionManager.getAcceptedStableTokens();

const paymentToken = new ethers.Contract(paymentTokenAddress, erc20Abi, signer);
const paymentTokenDecimals = await paymentToken.decimals();
const paymentTokenSymbol = await paymentToken.symbol();

const tld = domainName.split('.').slice(1).join('.'); // should be "com" for "example.com"

// get the price for 1 year in stable token from acquisition manager
const oneYearPrice = await acquisitionManager.getStablePrice(tld, paymentToken.address);

const requiredPaymentAmount = oneYearPrice.mul(years);

// lets check if signer has enough balance to pay for the order before placing it with AcquisitionManager

const signerPaymentTokenBalance = await paymentToken.balanceOf(signer.address);

if(!signerPaymentTokenBalance.gte(requiredPaymentAmount)){
   throw new Error(`not enough balance (${paymentTokenSymbol}${ethers.utils.formatUnits(signerPaymentTokenBalance, paymentTokenDecimals)} ${paymentTokenSymbol}) to pay for this order (${paymentTokenSymbol}${ethers.utils.formatUnits(requiredPaymentAmount, paymentTokenDecimals)})`);
}



// before placing the order with AcquisitionManager we need to approve AcquisitionManager to spend requiredPaymentAmount of payment
Token from signer account

```

We can estimate a transaction gas cost by using [estimateGas](https://docs.ethers.io/v5/api/contract/contract/#contract-estimateGas)

```javascript

// lets estimate gas cost for approve transaction bellow and see if we have enough matic to pay for it

let estimatedGasUsage = await paymentToken.estimateGas.approve(acquisitionManager.address, requiredPaymentAmount);

if(!maticBalance.gt(estimatedGasUsage)){
throw new Error('not enough matic to pay for transaction');
}

```

```javascript
// lets approve the funds to be spent by AcquisitionManager
let tx = await paymentToken.approve(acquisitionManager.address, requiredPaymentAmount);
console.log(`transaction hash: ${tx.hash}`);
// we can wait for transaction block inclusion before going further
await tx.wait();
console.log(`transaction ${tx.hash} has been mined`);

// now AcquisitionManager contract can spend our payment token when we place the order

const ORDER_TYPES = {
 REGISTER: 1,
 IMPORT: 2,
 EXTEND: 3,
};
// best would be to estimate gas and see if the user has enough matic to pay for this transaction, as we did for payment token approval
tx = await acquisitionManager.request([
    ORDER_TYPES.REGISTER,
    tokenId,
    years,
    paymentToken.address,
    tld,
    encryptedInfoData
]);

console.log(`transaction to place an order with AcquisitionManager ${tx.hash}`);
// let's wait for transaction inclusion
await tx.wait();

// if everything is okay the transaction will be successful and we can see it under the list of orders saved in AcquisitionManager

const ownOrders = await acquisitionManager.userOrders(signer.address);
// we have the ids of all orders placed by signer. Let's suppose it's only one

const [orderId] = ownOrders;

const onChainOrderInfo = await acquisitionManager.orders[orderId];

console.log(onChainOrderInfo);

```
