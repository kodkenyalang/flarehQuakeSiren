/**
 * Deployment script for QuakeSiren Smart Contracts to Flare Coston Testnet
 * 
 * Prerequisites:
 * 1. Node.js installed
 * 2. Truffle installed (npm install -g truffle)
 * 3. HDWalletProvider installed (npm install @truffle/hdwallet-provider)
 * 4. A mnemonic phrase for a wallet with Coston testnet FLR tokens
 *    (Get testnet tokens from the Coston Faucet: https://faucet.flare.network/)
 */

const HDWalletProvider = require('@truffle/hdwallet-provider');
const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
const config = require('./deploy-config');

// Get contract artifacts
const EarthquakeData = {
  abi: JSON.parse(fs.readFileSync(path.join(__dirname, 'artifacts/EarthquakeData.json'), 'utf8')).abi,
  bytecode: JSON.parse(fs.readFileSync(path.join(__dirname, 'artifacts/EarthquakeData.json'), 'utf8')).bytecode
};

const EarthquakeAlertSubscription = {
  abi: JSON.parse(fs.readFileSync(path.join(__dirname, 'artifacts/EarthquakeAlertSubscription.json'), 'utf8')).abi,
  bytecode: JSON.parse(fs.readFileSync(path.join(__dirname, 'artifacts/EarthquakeAlertSubscription.json'), 'utf8')).bytecode
};

const EarthquakeDataGovernance = {
  abi: JSON.parse(fs.readFileSync(path.join(__dirname, 'artifacts/EarthquakeDataGovernance.json'), 'utf8')).abi,
  bytecode: JSON.parse(fs.readFileSync(path.join(__dirname, 'artifacts/EarthquakeDataGovernance.json'), 'utf8')).bytecode
};

async function deploy() {
  try {
    // Select network from config
    const network = process.argv[2] || 'coston';
    if (!config.networks[network]) {
      throw new Error(`Network ${network} not found in config`);
    }
    console.log(`Deploying to ${network} network...`);
    
    // Setup provider
    const provider = new HDWalletProvider({
      mnemonic: {
        phrase: config.deployer.mnemonic
      },
      providerOrUrl: config.networks[network].url
    });
    
    const web3 = new Web3(provider);
    const accounts = await web3.eth.getAccounts();
    const deployer = accounts[0];
    
    console.log(`Deploying from address: ${deployer}`);
    console.log(`Account balance: ${web3.utils.fromWei(await web3.eth.getBalance(deployer), 'ether')} ${network === 'coston' ? 'CFLR' : 'ETH'}`);
    
    // Deploy EarthquakeData contract
    console.log('\nDeploying EarthquakeData contract...');
    const dataContract = new web3.eth.Contract(EarthquakeData.abi);
    const dataDeployment = dataContract.deploy({
      data: EarthquakeData.bytecode,
      arguments: []
    });
    
    const deployedDataContract = await dataDeployment.send({
      from: deployer,
      gas: config.networks[network].gas,
      gasPrice: config.networks[network].gasPrice
    });
    
    console.log(`EarthquakeData deployed at: ${deployedDataContract.options.address}`);
    
    // Deploy EarthquakeAlertSubscription contract
    console.log('\nDeploying EarthquakeAlertSubscription contract...');
    const subscriptionContract = new web3.eth.Contract(EarthquakeAlertSubscription.abi);
    const subscriptionDeployment = subscriptionContract.deploy({
      data: EarthquakeAlertSubscription.bytecode,
      arguments: []
    });
    
    const deployedSubscriptionContract = await subscriptionDeployment.send({
      from: deployer,
      gas: config.networks[network].gas,
      gasPrice: config.networks[network].gasPrice
    });
    
    console.log(`EarthquakeAlertSubscription deployed at: ${deployedSubscriptionContract.options.address}`);
    
    // Deploy EarthquakeDataGovernance contract
    console.log('\nDeploying EarthquakeDataGovernance contract...');
    const governanceContract = new web3.eth.Contract(EarthquakeDataGovernance.abi);
    const governanceDeployment = governanceContract.deploy({
      data: EarthquakeDataGovernance.bytecode,
      arguments: [config.governanceConfig.votingPeriodInDays]
    });
    
    const deployedGovernanceContract = await governanceDeployment.send({
      from: deployer,
      gas: config.networks[network].gas,
      gasPrice: config.networks[network].gasPrice
    });
    
    console.log(`EarthquakeDataGovernance deployed at: ${deployedGovernanceContract.options.address}`);
    
    // Set up contract relationships
    console.log('\nSetting up contract relationships...');
    
    // Set governance contract in EarthquakeData
    console.log('Setting governance contract in EarthquakeData...');
    await deployedDataContract.methods.setGovernanceContract(
      deployedGovernanceContract.options.address
    ).send({
      from: deployer,
      gas: config.networks[network].gas,
      gasPrice: config.networks[network].gasPrice
    });
    
    // Set data contract in EarthquakeAlertSubscription
    console.log('Setting data contract in EarthquakeAlertSubscription...');
    await deployedSubscriptionContract.methods.setDataContract(
      deployedDataContract.options.address
    ).send({
      from: deployer,
      gas: config.networks[network].gas,
      gasPrice: config.networks[network].gasPrice
    });
    
    // Set data contract in EarthquakeDataGovernance
    console.log('Setting data contract in EarthquakeDataGovernance...');
    await deployedGovernanceContract.methods.setDataContract(
      deployedDataContract.options.address
    ).send({
      from: deployer,
      gas: config.networks[network].gas,
      gasPrice: config.networks[network].gasPrice
    });
    
    // Write deployment information to file
    const deploymentInfo = {
      network: network,
      deploymentTime: new Date().toISOString(),
      contracts: {
        EarthquakeData: {
          address: deployedDataContract.options.address,
          deployer: deployer
        },
        EarthquakeAlertSubscription: {
          address: deployedSubscriptionContract.options.address,
          deployer: deployer
        },
        EarthquakeDataGovernance: {
          address: deployedGovernanceContract.options.address,
          deployer: deployer,
          votingPeriodInDays: config.governanceConfig.votingPeriodInDays
        }
      }
    };
    
    fs.writeFileSync(
      path.join(__dirname, `deployment-${network}.json`),
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log('\nDeployment complete!');
    console.log(`Deployment information saved to deployment-${network}.json`);
    
    // Create a flareConnector.js file with the deployed contract addresses
    generateFlareConnector(deploymentInfo);
    
    // End the process
    provider.engine.stop();
    
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

function generateFlareConnector(deploymentInfo) {
  console.log('\nGenerating flareConnector.js file...');
  
  const flareConnectorPath = path.join(__dirname, 'flareConnector.js');
  
  const content = `/**
 * flareConnector.js
 * 
 * This utility file provides functions to interact with the QuakeSiren smart contracts
 * deployed on the Flare Coston testnet.
 */

const Web3 = require('web3');
const EarthquakeDataABI = require('./artifacts/EarthquakeData.json').abi;
const EarthquakeAlertSubscriptionABI = require('./artifacts/EarthquakeAlertSubscription.json').abi;
const EarthquakeDataGovernanceABI = require('./artifacts/EarthquakeDataGovernance.json').abi;

// Contract addresses from deployment
const EARTHQUAKE_DATA_ADDRESS = '${deploymentInfo.contracts.EarthquakeData.address}';
const EARTHQUAKE_ALERT_SUBSCRIPTION_ADDRESS = '${deploymentInfo.contracts.EarthquakeAlertSubscription.address}';
const EARTHQUAKE_DATA_GOVERNANCE_ADDRESS = '${deploymentInfo.contracts.EarthquakeDataGovernance.address}';

// Flare network RPC URL
const NETWORK_RPC_URL = '${config.networks[deploymentInfo.network].url}';

// Scale factor for decimal values
const SCALE_FACTOR = 1000000;

/**
 * Initialize contracts with their addresses
 */
function initializeContracts(web3) {
  return {
    earthquakeData: new web3.eth.Contract(EarthquakeDataABI, EARTHQUAKE_DATA_ADDRESS),
    alertSubscription: new web3.eth.Contract(EarthquakeAlertSubscriptionABI, EARTHQUAKE_ALERT_SUBSCRIPTION_ADDRESS),
    dataGovernance: new web3.eth.Contract(EarthquakeDataGovernanceABI, EARTHQUAKE_DATA_GOVERNANCE_ADDRESS)
  };
}

/**
 * Helper to scale values for blockchain storage
 */
function scaleForBlockchain(value) {
  return Math.round(value * SCALE_FACTOR);
}

/**
 * Helper to descale values from blockchain to real-world values
 */
function descaleFromBlockchain(value) {
  return value / SCALE_FACTOR;
}

/**
 * Convert a blockchain earthquake to the QuakeSiren app format
 */
function convertBlockchainEarthquakeToAppFormat(blockchainEarthquake) {
  return {
    id: blockchainEarthquake.id,
    latitude: descaleFromBlockchain(blockchainEarthquake.latitude),
    longitude: descaleFromBlockchain(blockchainEarthquake.longitude),
    magnitude: descaleFromBlockchain(blockchainEarthquake.magnitude),
    depth: descaleFromBlockchain(blockchainEarthquake.depth),
    time: new Date(blockchainEarthquake.time * 1000).toISOString(),
    place: blockchainEarthquake.place,
    verified: blockchainEarthquake.verified,
    verifications: blockchainEarthquake.verifications
  };
}

/**
 * Main export functions for integration with QuakeSiren app
 */
module.exports = {
  /**
   * Check if connection to Flare Network is available
   * @returns {Promise<boolean>} True if connected
   */
  async checkConnection() {
    try {
      const web3 = new Web3(NETWORK_RPC_URL);
      await web3.eth.getBlockNumber();
      return true;
    } catch (error) {
      console.error('Error connecting to Flare Network:', error);
      return false;
    }
  },

  /**
   * Get the current wallet address if connected via browser wallet
   * @returns {Promise<string>} Wallet address
   */
  async getWalletAddress() {
    if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        return accounts[0];
      } catch (error) {
        console.error('Error getting wallet address:', error);
        return '';
      }
    }
    return '';
  },

  /**
   * Get the Flare Network details and contract status
   * @returns {Promise<Object>} Network status
   */
  async getNetworkStatus() {
    try {
      const web3 = new Web3(NETWORK_RPC_URL);
      const contracts = initializeContracts(web3);
      
      const [blockNumber, earthquakeCount] = await Promise.all([
        web3.eth.getBlockNumber(),
        contracts.earthquakeData.methods.earthquakeCount().call()
      ]);
      
      return {
        network: '${deploymentInfo.network}',
        blockNumber: blockNumber,
        dataBlocksStored: parseInt(earthquakeCount),
        totalCapacity: 2000, // Example fixed capacity
        isConnected: true
      };
    } catch (error) {
      console.error('Error getting network status:', error);
      return {
        network: '${deploymentInfo.network}',
        isConnected: false,
        error: error.message
      };
    }
  },

  /**
   * Record a new earthquake on the blockchain
   * @param {Object} earthquake Earthquake data in QuakeSiren format
   * @param {string} privateKey Private key to sign transaction (or null to use browser wallet)
   * @returns {Promise<Object>} Transaction receipt
   */
  async recordEarthquake(earthquake, privateKey = null) {
    try {
      const web3 = new Web3(NETWORK_RPC_URL);
      const contracts = initializeContracts(web3);
      let sender;
      
      if (privateKey) {
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        web3.eth.accounts.wallet.add(account);
        sender = account.address;
      } else if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        sender = accounts[0];
        
        // Use the provider from the browser
        web3.setProvider(window.ethereum);
      } else {
        throw new Error('No private key or browser wallet available');
      }
      
      const receipt = await contracts.earthquakeData.methods.recordEarthquake(
        earthquake.id,
        scaleForBlockchain(earthquake.latitude),
        scaleForBlockchain(earthquake.longitude),
        scaleForBlockchain(earthquake.magnitude),
        scaleForBlockchain(earthquake.depth),
        Math.floor(new Date(earthquake.time).getTime() / 1000),
        earthquake.place
      ).send({
        from: sender,
        gas: 500000
      });
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('Error recording earthquake:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Get earthquake data from the blockchain
   * @param {string} earthquakeId The ID of the earthquake to fetch
   * @returns {Promise<Object>} Earthquake data in QuakeSiren format
   */
  async getEarthquake(earthquakeId) {
    try {
      const web3 = new Web3(NETWORK_RPC_URL);
      const contracts = initializeContracts(web3);
      
      const result = await contracts.earthquakeData.methods.getEarthquake(earthquakeId).call();
      
      return convertBlockchainEarthquakeToAppFormat({
        id: result.id,
        latitude: result.latitude,
        longitude: result.longitude,
        magnitude: result.magnitude,
        depth: result.depth,
        time: result.time,
        place: result.place,
        verified: result.verified,
        verifications: result.verifications
      });
    } catch (error) {
      console.error('Error getting earthquake:', error);
      return null;
    }
  },

  /**
   * Get recent earthquakes from the blockchain
   * @param {number} limit Maximum number of earthquakes to fetch
   * @returns {Promise<Array>} Array of earthquake data in QuakeSiren format
   */
  async getRecentEarthquakes(limit = 10) {
    try {
      const web3 = new Web3(NETWORK_RPC_URL);
      const contracts = initializeContracts(web3);
      
      const ids = await contracts.earthquakeData.methods.getRecentEarthquakeIds(limit).call();
      
      const earthquakes = await Promise.all(
        ids.map(id => this.getEarthquake(id))
      );
      
      return earthquakes.filter(e => e !== null);
    } catch (error) {
      console.error('Error getting recent earthquakes:', error);
      return [];
    }
  },

  /**
   * Create a subscription for earthquake alerts
   * @param {Object} subscriptionData Subscription parameters
   * @returns {Promise<Object>} Transaction receipt
   */
  async createSubscription(subscriptionData) {
    try {
      const web3 = new Web3(NETWORK_RPC_URL);
      const contracts = initializeContracts(web3);
      
      let sender;
      if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        sender = accounts[0];
        
        // Use the provider from the browser
        web3.setProvider(window.ethereum);
      } else {
        throw new Error('Browser wallet required for subscriptions');
      }
      
      const costPerMonth = web3.utils.toWei('0.1', 'ether'); // 0.1 FLR per month
      const totalCost = web3.utils.toBN(costPerMonth).mul(web3.utils.toBN(subscriptionData.months));
      
      const receipt = await contracts.alertSubscription.methods.createSubscription(
        scaleForBlockchain(subscriptionData.minMagnitude),
        scaleForBlockchain(subscriptionData.minLatitude),
        scaleForBlockchain(subscriptionData.maxLatitude),
        scaleForBlockchain(subscriptionData.minLongitude),
        scaleForBlockchain(subscriptionData.maxLongitude),
        subscriptionData.months,
        subscriptionData.email,
        subscriptionData.organizationName
      ).send({
        from: sender,
        value: totalCost.toString(),
        gas: 500000
      });
      
      const events = receipt.events;
      const subscriptionCreatedEvent = events.SubscriptionCreated;
      const subscriptionId = subscriptionCreatedEvent ? subscriptionCreatedEvent.returnValues.id : null;
      
      return {
        success: true,
        subscriptionId: subscriptionId,
        transactionHash: receipt.transactionHash,
        cost: web3.utils.fromWei(totalCost.toString(), 'ether'),
        expiresAt: new Date(Date.now() + (subscriptionData.months * 30 * 24 * 60 * 60 * 1000)).toISOString()
      };
    } catch (error) {
      console.error('Error creating subscription:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Check for new earthquake alerts for the current subscriber
   * @returns {Promise<Array>} Array of new earthquake alerts
   */
  async checkAlerts() {
    // This would typically interact with the subscription contract
    // to get alerts for the connected wallet address
    try {
      const wallet = await this.getWalletAddress();
      if (!wallet) {
        return [];
      }
      
      // For now, return an empty array
      // In a full implementation, this would query active subscriptions
      // and return any matching earthquake alerts
      return [];
    } catch (error) {
      console.error('Error checking alerts:', error);
      return [];
    }
  }
};
`;
  
  fs.writeFileSync(flareConnectorPath, content);
  console.log(`Generated flareConnector.js with deployed contract addresses`);
}

// Run the deployment
deploy();