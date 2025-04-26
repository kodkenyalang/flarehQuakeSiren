/**
 * Configuration for deploying QuakeSiren contracts to Flare Coston testnet
 * 
 * IMPORTANT: 
 * - Keep your mnemonic secure and never commit it to version control
 * - In a production environment, use environment variables or a secure vault
 */

module.exports = {
  // Network configurations
  networks: {
    coston: {
      network_id: 16,
      chainId: 16,
      url: "https://coston-api.flare.network/ext/bc/C/rpc",
      gas: 8000000,
      gasPrice: 25000000000, // 25 Gwei
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true
    },
    coston2: {
      network_id: 114,
      chainId: 114,
      url: "https://coston2-api.flare.network/ext/C/rpc",
      gas: 8000000,
      gasPrice: 25000000000, // 25 Gwei
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true
    },
    local: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*"
    }
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  },

  // Governance contract configuration
  governanceConfig: {
    votingPeriodInDays: 3 // Voting period for proposals (in days)
  },

  // Contract deployer account
  // NEVER store real mnemonics in this file! Use environment variables in production
  // For example: { mnemonic: process.env.DEPLOYER_MNEMONIC }
  deployer: {
    mnemonic: "YOUR_MNEMONIC_HERE" // Replace with your mnemonic or use env vars
  },

  // Explorer API keys for contract verification (optional)
  // In a real deployment, you would add these for contract verification
  explorerApiKeys: {
    costonExplorer: "YOUR_EXPLORER_API_KEY"
  }
};