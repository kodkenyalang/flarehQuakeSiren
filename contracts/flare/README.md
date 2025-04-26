# QuakeSiren Flare Network Smart Contracts

This directory contains smart contracts for the QuakeSiren decentralized earthquake tracking and early warning system on the Flare Network.

## Overview

QuakeSiren leverages the Flare Network to provide decentralized and transparent earthquake data, enabling businesses and finance houses to mitigate risk and respond to natural disasters more effectively.

### Contracts

1. **EarthquakeData.sol**: Primary contract for storing and verifying earthquake data on the blockchain.
2. **EarthquakeAlertSubscription.sol**: Subscription service that allows businesses to receive alerts for earthquakes in their regions of interest.
3. **EarthquakeDataGovernance.sol**: Decentralized governance system that allows the community to vote on data verification.

## Deployment Guide

### Prerequisites

- Node.js and npm installed
- Truffle framework installed (`npm install -g truffle`)
- HDWalletProvider installed (`npm install @truffle/hdwallet-provider`)
- Web3.js installed (`npm install web3`)
- A mnemonic phrase for a wallet with Coston testnet FLR tokens

### Getting Testnet Tokens

Before deploying, you'll need to get some testnet FLR tokens from the Coston Faucet:

1. Visit [https://faucet.flare.network/](https://faucet.flare.network/)
2. Enter your Flare Network wallet address
3. Request the testnet tokens

### Configuration

1. Edit the `deploy-config.js` file and replace the placeholder mnemonic with your own.
2. Adjust other settings as needed.

### Compilation

Compile the contracts using Truffle:

```bash
truffle compile
```

This will create a `build/contracts` directory with the compiled contract artifacts.

### Deployment

Run the deployment script:

```bash
node deploy.js
```

This will:
1. Deploy all three contracts
2. Set up the necessary authorization between contracts
3. Save the deployment information to `deployment-info.json`

## Contract Interaction

### EarthquakeData Contract

#### Recording Earthquake Data

Only authorized reporters can record earthquake data:

```javascript
// Example: Recording an earthquake using Web3.js
const earthquakeData = new web3.eth.Contract(EarthquakeData.abi, deployedAddress);

// Parameters - note that latitude, longitude, magnitude, and depth are scaled
await earthquakeData.methods.recordEarthquake(
  "eq_123456",              // id
  "San Francisco, CA",      // place
  Math.floor(Date.now()/1000), // time
  37654321,                 // latitude (37.654321 scaled by 10^6)
  -122765432,               // longitude (-122.765432 scaled by 10^6)
  67,                       // magnitude (6.7 scaled by 10^1)
  105                       // depth (10.5km scaled by 10^1)
).send({ from: authorizedAddress, gas: 200000 });
```

#### Verifying Earthquake Data

```javascript
await earthquakeData.methods.verifyEarthquake(
  "eq_123456",              // id
  true                      // verified status
).send({ from: authorizedAddress, gas: 100000 });
```

### EarthquakeAlertSubscription Contract

#### Creating a Subscription

```javascript
const subscription = new web3.eth.Contract(
  EarthquakeAlertSubscription.abi, 
  deployedAddress
);

// Example: Subscribing to earthquakes in California region
await subscription.methods.createSubscription(
  "Acme Insurance Co.",     // organization name
  32000000,                 // minLatitude (32.0 degrees N)
  42000000,                 // maxLatitude (42.0 degrees N)
  -125000000,               // minLongitude (-125.0 degrees W)
  -114000000,               // maxLongitude (-114.0 degrees W)
  50,                       // minMagnitude (5.0)
  3                         // subscribe for 3 months
).send({ 
  from: subscriberAddress, 
  value: web3.utils.toWei("0.3", "ether"),  // 0.1 FLR per month * 3 months
  gas: 300000 
});
```

#### Checking for Alerts

```javascript
// Check for new alerts in the subscribed region
const result = await subscription.methods.checkForAlerts()
  .send({ from: subscriberAddress, gas: 500000 });

// The transaction receipt will include emitted alert events
```

### EarthquakeDataGovernance Contract

#### Creating a Verification Request

```javascript
const governance = new web3.eth.Contract(
  EarthquakeDataGovernance.abi, 
  deployedAddress
);

// Submit an earthquake for community verification
await governance.methods.createVerificationRequest("eq_123456")
  .send({ from: tokenHolderAddress, gas: 200000 });
```

#### Voting on Verification

```javascript
// Vote on an earthquake verification request
await governance.methods.vote(0, true)  // requestId = 0, inSupport = true
  .send({ from: voterAddress, gas: 100000 });
```

#### Executing Verification Result

```javascript
// Execute verification after voting period ends
await governance.methods.executeVerification(0)  // requestId = 0
  .send({ from: anyAddress, gas: 200000 });
```

## Security Considerations

- These contracts should be thoroughly audited before mainnet deployment
- Use secure key management for any production deployments
- Consider implementing multisig controls for owner actions
- Verify authenticity of earthquake data sources before recording on-chain

## License

MIT License