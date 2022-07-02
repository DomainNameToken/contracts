const { ethers } = require('hardhat');

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

const hashOrderInformation = (info) => {
  const i = [
    info.tokenContract,
    info.customer,
    info.chainId,
    info.orderType,
    info.tokenId,
    info.numberOfYears,
    info.paymentToken,
    info.paymentAmount,
    info.paymentWindow,
    info.requestTime,
    info.openWindow,
    info.nonce,
  ];
  const encoded = ethers.utils.defaultAbiCoder.encode([
    'address', // tokenContract
    'address', // customer
    'uint256', // chainId
    'uint256', // orderType
    'uint256', // tokenId
    'uint256', // numberOfYears
    'address', // paymentToken
    'uint256', // paymentAmount
    'uint256', // paymentWindow
    'uint256', // requestTime
    'uint256', // openWindow
    'uint256', // nonce
  ], i);
  return ethers.utils.keccak256(
    encoded,
  );
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

const ZEROA = ethers.constants.AddressZero;
const now = () => Math.floor(Date.now() / 1000);
const generateInfo = async (
  custodianGateway,
  type,
  domainName,
  sourceOwner = ZEROA,
  destinationOwner = ZEROA,
  expiry = now() + 3600 * 24 * 365,

) => {
  const block = await ethers.provider.getBlock();
  const { chainId } = await ethers.provider.getNetwork();
  const tokenId = encodeDomainToId(domainName);

  if (type == 'mint') {
    return {
      messageType: messageType(type),
      custodian: custodianGateway.address,
      tokenId,
      source: {
        chainId: 0,
        owner: sourceOwner.address ? sourceOwner.address : sourceOwner,
        blockNumber: 0,
      },
      destination: {
        chainId,
        owner: destinationOwner.address ? destinationOwner.address : destinationOwner,
        blockNumber: parseInt(`${block.number}`, 10) - 1,
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
const infoEncode = (mintInfo) => {
  const i = [[mintInfo.messageType, mintInfo.custodian, mintInfo.tokenId, [mintInfo.source.chainId, mintInfo.source.owner, mintInfo.source.blockNumber], [mintInfo.destination.chainId, mintInfo.destination.owner, mintInfo.destination.blockNumber], mintInfo.domainName, mintInfo.expiry]];

  return i;
};
const encodeDomainInfoFn = (domainGateway, fn, mintInfo, domainImplementation) => domainImplementation.interface.encodeFunctionData(`${fn}((uint256,address,uint256,(uint256,address,uint256),(uint256,address,uint256),string,uint256))`, infoEncode(mintInfo));
const nonceGroupId = (str) => ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string'], [str]));

const nextNonce = (() => {
  const nonce = { general: 100 };
  return (group = undefined) => {
    if (!group) {
      nonce.general += 1;
      return nonce.general;
    }
    if (!nonce[group]) {
      nonce[group] = 100;
    }
    nonce[group] += 1;
    return nonce[group];
  };
})();

const getAcquisitionOrderInfo = async ({
  domainToken,
  custodian,
  customer,
  orderType = 0, // registration
  domainName = 'testdomainname.com',
  years = 1,
  paymentToken = ZEROA,
  paymentAmount = ethers.utils.parseUnits('0.01', 18),
  nonce,
  admin,
}) => {
  const info = {
    admin,
    tokenContract: domainToken.address,
    customer: customer.address,
    chainId: (await ethers.provider.getNetwork()).chainId,
    orderType,
    numberOfYears: years,
    paymentToken: paymentToken.address ? paymentToken.address : paymentToken,
    paymentAmount,
    tokenId: encodeDomainToId(domainName),
    paymentWindow: 15 * 60,
    requestTime: now(),
    openWindow: 24 * 3600,
    nonce,
  };
  const hash = hashOrderInformation(info);
  const mintFn = orderType <= 1 ? 'mint' : 'extend';
  const mintInfo = {
    messageType: messageType(orderType <= 1 ? 'mint' : 'extend'),
    custodian: custodian.address,
    tokenId: info.tokenId,
    source: {
      chainId: (orderType <= 1 ? 0 : info.chainId),
      owner: orderType <= 1 ? ZEROA : customer.address,
      blockNumber: 0,
    },
    destination: {
      chainId: info.chainId,
      owner: customer.address,
      blockNumber: 0,
    },
    domainName,
    expiry: info.requestTime + info.numberOfYears * 365 * 24 * 3600,
  };
  const mintInfoEncoded = encodeDomainInfoFn(domainToken, mintFn, mintInfo, domainToken);
  const signatureNonceGroup = nonceGroupId('domains.mint');
  const signatureNonce = nextNonce(signatureNonceGroup);
  const successHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['address', 'bytes', 'bytes32', 'uint256'],
      [domainToken.address,
        mintInfoEncoded,
        signatureNonceGroup,
        signatureNonce],
    ),
  );
  const successSignature = await admin.signMessage(ethers.utils.arrayify(successHash));
  return {
    orderInfo: info,
    hash,
    signature: await admin.signMessage(ethers.utils.arrayify(hash)),
    success: {
      data: mintInfoEncoded,
      signatureNonceGroup,
      signatureNonce,
      hash: successHash,
      signature: successSignature,
    },
  };
};

module.exports = {
  encodeDomainInfoFn,
  nonceGroupId,
  infoEncode,
  generateInfo,
  hashInformation,
  flattenArray,
  messageType,
  encodeDomainToId,
  now,
  hashOrderInformation,
  getAcquisitionOrderInfo,
};
