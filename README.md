# QuakeSiren: Decentralized Earthquake Tracking and Early Warning System

QuakeSiren is a decentralized application (dApp) for real-time earthquake tracking and early warning signals, leveraging the Flare Network to serve as a reliable data connector for businesses and financial institutions.

![QuakeSiren Dashboard](https://github.com/your-username/quakesiren/raw/main/docs/dashboard-preview.png)

## Features

- 🌎 **Real-time earthquake tracking** with interactive map visualization
- ⚡ **Early warning system** for timely disaster response
- 🔗 **Blockchain-based data verification** on Flare Network
- 📊 **Analytics dashboard** for historical earthquake data
- 🔔 **Subscription service** for location-based earthquake alerts
- 🌐 **Decentralized governance** for earthquake data verification
- 💹 **Financial Impact Oracle** providing market risk assessment for 20 FLR tokens
- 💰 **Enterprise Tier Risk Assessment** with premium financial analysis for 20,000,000 FLR/month

## Technology Stack

- **Frontend:** React, TypeScript, TailwindCSS, shadcn/ui
- **Backend:** Node.js, Express
- **Mapping:** MapBox GL JS
- **Blockchain:** Flare Network (Coston Testnet)
- **Smart Contracts:** Solidity
- **Real-time Updates:** WebSockets

## Smart Contracts

QuakeSiren utilizes five main smart contracts on the Flare Network:

1. **EarthquakeData.sol**: Primary contract for storing and verifying earthquake data on the blockchain
2. **EarthquakeAlertSubscription.sol**: Subscription service that allows businesses to receive alerts for earthquakes in their regions of interest
3. **EarthquakeDataGovernance.sol**: Decentralized governance system that allows the community to verify data accuracy
4. **EarthquakeOracleService.sol**: Financial Impact Oracle that provides market risk assessment for a fee of 20 FLR tokens per API key
5. **EnterpriseRiskAssessmentService.sol**: Premium risk assessment service for financial institutions with comprehensive analysis for 20,000,000 FLR per month

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn
- MapBox API key
- Flare Network account with Coston testnet tokens

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/quakesiren.git
   cd quakesiren
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your API keys:
   ```
   MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5000`

### Smart Contract Deployment

1. Navigate to the contracts directory:
   ```bash
   cd contracts/flare
   ```

2. Edit the `deploy-config.js` file and add your Flare Network wallet mnemonic

3. Run the deployment script:
   ```bash
   node deploy.js
   ```

## Use Cases

QuakeSiren serves as a critical data connector for:

- **Insurance Companies**: Real-time data for risk assessment and automated claim processing
- **Financial Institutions**: Data for catastrophe bond pricing and risk modeling
- **Investment Banks**: Premium Enterprise tier (20M FLR/month) provides detailed financial center risk assessments
- **Government Agencies**: Early warning and emergency response coordination
- **Logistics Companies**: Supply chain rerouting and disaster response planning
- **Real Estate Developers**: Location risk assessment and construction planning
- **Investment Firms**: Financial Impact Oracle provides specialized market risk assessment (20 FLR/request)
- **Hedge Funds**: Flare Data Connector (FDC) enterprise tier for exclusive market disruption analysis

## Data Sources

The application aggregates and verifies earthquake data from multiple sources:

- USGS Earthquake Data API
- European-Mediterranean Seismological Centre
- Flare Network decentralized oracle network
- Community-submitted reports (verified through governance)

## Contributing

We welcome contributions to QuakeSiren! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to submit pull requests, report bugs, and suggest features.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Flare Network for providing the blockchain infrastructure
- MapBox for their mapping API
- USGS for earthquake data