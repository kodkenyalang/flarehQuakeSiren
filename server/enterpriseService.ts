import { flareTransactions, InsertFlareTransaction, FlareTransaction } from "@shared/schema";

/**
 * Enterprise subscription interface
 */
interface EnterpriseSubscription {
  address: string;
  startTime: Date;
  endTime: Date;
  active: boolean;
  totalPaid: string; // In FLR tokens
}

/**
 * Risk assessment request parameters interface
 */
interface RiskAssessmentRequest {
  financialCenter: string;
  region: string;
  timeHorizon: string;
  confidenceLevel: number;
  portfolioType: string;
}

/**
 * Risk assessment result interface
 */
interface RiskAssessmentResult {
  id: string;
  financialCenter: string;
  riskScore: number;
  impactProbability: number;
  marketVolatility: number;
  currencyRisk: number;
  supplyChainDisruption: number;
  estimatedFinancialLoss: string;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | 'CRITICAL';
  recommendations: string[];
  ipfsHash?: string; // IPFS hash of detailed report
  blockchainTxId?: string; // Transaction ID on Flare Network
  verified: boolean;
  createdAt: Date;
}

// In-memory storage for enterprise subscriptions
const enterpriseSubscriptions: { [key: string]: EnterpriseSubscription } = {
  // Sample active subscription
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266": {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    startTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    endTime: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),   // 20 days from now
    active: true,
    totalPaid: "20,000,000"
  }
};

// In-memory storage for transactions
const flareEnterpriseTransactions: FlareTransaction[] = [];

/**
 * Check if an address has an active enterprise subscription
 * @param walletAddress The blockchain wallet address to check
 * @returns Boolean indicating if subscription is active
 */
export async function hasActiveSubscription(walletAddress: string): Promise<boolean> {
  // If the wallet address is not provided, return false
  if (!walletAddress) {
    return false;
  }
  
  // Check if the address exists in the subscriptions map
  const subscription = enterpriseSubscriptions[walletAddress];
  
  // If no subscription found, return false
  if (!subscription) {
    return false;
  }
  
  // Check if subscription is active and not expired
  return subscription.active && subscription.endTime > new Date();
}

/**
 * Process a risk assessment request through the Flare Network
 * @param walletAddress The blockchain wallet address requesting the assessment
 * @param request The risk assessment parameters
 * @returns Risk assessment results or null if subscription is inactive
 */
export async function processRiskAssessment(
  walletAddress: string,
  request: RiskAssessmentRequest
): Promise<RiskAssessmentResult | null> {
  // First check if the wallet has an active subscription
  const isActive = await hasActiveSubscription(walletAddress);
  
  if (!isActive) {
    console.log(`Wallet ${walletAddress} does not have an active enterprise subscription`);
    return null;
  }
  
  console.log(`Processing risk assessment for wallet ${walletAddress}`);
  
  // Determine which financial centers to analyze based on region
  const financialCenters = getFinancialCentersForRegion(request.region);
  
  // If a specific financial center is provided, filter to just that one
  const centersToAnalyze = request.financialCenter 
    ? financialCenters.filter(c => c.id === request.financialCenter)
    : financialCenters;
  
  // If no centers match, use a default one
  if (centersToAnalyze.length === 0) {
    const defaultCenter = { 
      id: 'NYC', 
      name: 'New York', 
      region: 'americas',
      currency: 'USD'
    };
    
    // Generate a risk assessment for the default center
    const txHash = await recordTransactionOnFlare(
      walletAddress,
      'ENTERPRISE_RISK_ASSESSMENT',
      { center: defaultCenter.id, parameters: request }
    );
    
    return generateRiskAssessment(defaultCenter, request, txHash);
  }
  
  // Use the first matching center
  const center = centersToAnalyze[0];
  
  // Record this transaction on the Flare blockchain
  const txHash = await recordTransactionOnFlare(
    walletAddress,
    'ENTERPRISE_RISK_ASSESSMENT',
    { center: center.id, parameters: request }
  );
  
  // Generate a risk assessment for this financial center
  return generateRiskAssessment(center, request, txHash);
}

/**
 * Get financial centers for a specific region
 * @param region The region to get financial centers for
 * @returns Array of financial center identifiers
 */
function getFinancialCentersForRegion(region: string): { id: string, name: string, region: string, currency: string }[] {
  const allFinancialCenters = [
    { id: 'NYC', name: 'New York', region: 'americas', currency: 'USD' },
    { id: 'LON', name: 'London', region: 'europe', currency: 'GBP' },
    { id: 'TKY', name: 'Tokyo', region: 'asia-pacific', currency: 'JPY' },
    { id: 'SNG', name: 'Singapore', region: 'asia-pacific', currency: 'SGD' },
    { id: 'HKG', name: 'Hong Kong', region: 'asia-pacific', currency: 'HKD' },
    { id: 'SYD', name: 'Sydney', region: 'asia-pacific', currency: 'AUD' },
    { id: 'ZRH', name: 'Zurich', region: 'europe', currency: 'CHF' },
    { id: 'FRK', name: 'Frankfurt', region: 'europe', currency: 'EUR' },
    { id: 'SHG', name: 'Shanghai', region: 'asia-pacific', currency: 'CNY' }
  ];
  
  // If global region is selected, return all centers
  if (region === 'global') {
    return allFinancialCenters;
  }
  
  // Otherwise, filter by the specified region
  return allFinancialCenters.filter(center => center.region === region);
}

/**
 * Generate a risk assessment for a specific financial center
 * @param center The financial center details
 * @param request The risk assessment request parameters
 * @param txHash The blockchain transaction hash
 * @returns Risk assessment result
 */
function generateRiskAssessment(
  center: { id: string, name: string, region: string, currency: string },
  request: RiskAssessmentRequest,
  txHash: string
): RiskAssessmentResult {
  // Generate a deterministic but "random" risk score based on inputs
  const centerValue = center.id.charCodeAt(0) + center.id.charCodeAt(1) + center.id.charCodeAt(2);
  const portfolioFactor = request.portfolioType === 'aggressive' ? 1.2 : 
                          request.portfolioType === 'conservative' ? 0.8 : 1.0;
  const confidenceFactor = request.confidenceLevel / 100;
  
  // Calculate risk metrics
  const baseRiskScore = ((centerValue % 7) + 2) * portfolioFactor;
  const riskScore = Math.min(10, Math.max(1, baseRiskScore));
  
  // Calculate impact probability based on risk score and confidence level
  const impactProbability = Math.min(0.95, Math.max(0.05, (riskScore / 20) + (0.5 - confidenceFactor)));
  
  // Calculate other risk metrics
  const marketVolatility = Math.min(100, Math.max(10, riskScore * 8 + (centerValue % 30)));
  const currencyRisk = Math.min(100, Math.max(15, (riskScore * 7) + ((center.region === 'asia-pacific') ? 10 : 0)));
  const supplyChainDisruption = Math.min(100, Math.max(20, (riskScore * 9) + ((request.timeHorizon === '365d') ? 15 : 0)));
  
  // Calculate estimated financial loss (formatted as currency)
  const baseLoss = (1000000 * riskScore * impactProbability);
  const timeMultiplier = request.timeHorizon === '7d' ? 0.3 :
                        request.timeHorizon === '30d' ? 1.0 :
                        request.timeHorizon === '90d' ? 2.5 :
                        request.timeHorizon === '180d' ? 4.0 : 8.0;
  const formattedLoss = (baseLoss * timeMultiplier).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  
  // Determine risk level based on risk score
  let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | 'CRITICAL';
  if (riskScore < 3) riskLevel = 'LOW';
  else if (riskScore < 5) riskLevel = 'MODERATE';
  else if (riskScore < 7) riskLevel = 'HIGH';
  else if (riskScore < 9) riskLevel = 'SEVERE';
  else riskLevel = 'CRITICAL';
  
  // Generate recommendations based on risk level and financial center
  const recommendations = generateRecommendations(riskLevel, center.id, center.currency);
  
  // Create IPFS hash (simulate - in a real implementation this would be a real IPFS upload)
  const ipfsHash = `Qm${Buffer.from(txHash + center.id + Date.now()).toString('hex').substring(0, 44)}`;
  
  return {
    id: `risk-${Date.now()}-${center.id}`,
    financialCenter: center.id,
    riskScore,
    impactProbability,
    marketVolatility,
    currencyRisk,
    supplyChainDisruption,
    estimatedFinancialLoss: formattedLoss,
    riskLevel,
    recommendations,
    ipfsHash,
    blockchainTxId: txHash,
    verified: true,
    createdAt: new Date()
  };
}

/**
 * Generate recommendations based on risk level and financial center
 * @param riskLevel Risk assessment level
 * @param centerId Financial center ID
 * @param currency Financial center currency
 * @returns Array of recommendations
 */
function generateRecommendations(
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | 'CRITICAL',
  centerId: string,
  currency: string
): string[] {
  // Base recommendations that apply to all risk levels
  const baseRecommendations = [
    `Monitor ${currency}/${centerId === 'NYC' ? 'global' : 'USD'} exchange rate fluctuations closely`,
    "Update business continuity plans for seismic events",
    "Review supply chain resilience against disruptions"
  ];
  
  // Additional recommendations based on risk level
  let additionalRecommendations: string[] = [];
  
  switch (riskLevel) {
    case 'LOW':
      additionalRecommendations = [
        "Maintain standard risk management protocols",
        "Consider opportunistic investments in stable markets"
      ];
      break;
      
    case 'MODERATE':
      additionalRecommendations = [
        "Increase cash reserves by 10-15%",
        "Adjust hedging strategies to account for potential currency volatility",
        "Review insurance coverage for seismic-related business disruptions"
      ];
      break;
      
    case 'HIGH':
      additionalRecommendations = [
        "Implement currency hedging strategies immediately",
        "Reduce exposure to affected geographical regions by 20-30%",
        "Establish alternative supply chain routes",
        "Increase liquidity positioning for potential market disruptions"
      ];
      break;
      
    case 'SEVERE':
      additionalRecommendations = [
        "Activate emergency financial protocols",
        "Shift 40-50% of investments to stable assets",
        "Delay major capital expenditures until risk subsides",
        "Implement 24/7 monitoring of seismic activity in affected regions",
        "Prepare for potential market closures and trading halts"
      ];
      break;
      
    case 'CRITICAL':
      additionalRecommendations = [
        "Immediately convert majority of holdings to stable currencies",
        "Activate full business continuity protocols",
        "Suspend all non-essential operations in affected regions",
        "Consider temporary portfolio liquidation of high-risk assets",
        "Engage with central banking authorities for emergency liquidity access",
        "Prepare for extended market closures and financial system disruptions"
      ];
      break;
  }
  
  // Add financial center specific recommendations
  switch (centerId) {
    case 'NYC':
      additionalRecommendations.push(
        "Monitor Federal Reserve emergency actions and policy changes",
        "Evaluate exposure to US municipal bond markets"
      );
      break;
      
    case 'LON':
      additionalRecommendations.push(
        "Assess impact on GBP/EUR exchange rates",
        "Review UK regulatory response mechanisms"
      );
      break;
      
    case 'TKY':
      additionalRecommendations.push(
        "Monitor Bank of Japan intervention in currency markets",
        "Increase focus on JPY volatility impact on regional trade"
      );
      break;
      
    case 'SNG':
      additionalRecommendations.push(
        "Evaluate SGD liquidity across ASEAN markets",
        "Review exposure to shipping and logistics disruptions"
      );
      break;
      
    default:
      additionalRecommendations.push(
        `Assess local ${currency} liquidity conditions`,
        "Review local regulatory emergency procedures"
      );
  }
  
  // Combine and return all recommendations
  return [...baseRecommendations, ...additionalRecommendations];
}

/**
 * Record a transaction on the Flare Network
 * @param walletAddress Blockchain wallet address
 * @param transactionType Type of transaction
 * @param data Transaction data
 * @returns Transaction hash
 */
async function recordTransactionOnFlare(
  walletAddress: string,
  transactionType: string,
  data: any
): Promise<string> {
  // Generate a transaction hash (in a real implementation this would be a real blockchain TX)
  const txHash = `0x${Buffer.from(walletAddress + transactionType + Date.now() + Math.random()).toString('hex').substring(0, 64)}`;
  
  // Create a transaction record
  const transaction: InsertFlareTransaction = {
    transactionHash: txHash,
    walletAddress,
    transactionType,
    data: JSON.stringify(data),
    flareTokensUsed: transactionType === 'ENTERPRISE_SUBSCRIPTION' ? 20000000 : 0,
    verified: true,
    createdAt: new Date()
  };
  
  // Store the transaction (in a real implementation this would be stored in the database)
  const flareTransaction: FlareTransaction = {
    id: flareEnterpriseTransactions.length + 1,
    ...transaction
  };
  
  flareEnterpriseTransactions.push(flareTransaction);
  
  // Return the transaction hash
  return txHash;
}

/**
 * Create a new enterprise subscription on the Flare Network
 * @param walletAddress Blockchain wallet address
 * @returns Transaction hash of subscription creation
 */
export async function createEnterpriseSubscription(walletAddress: string): Promise<string> {
  // Check if subscription already exists
  if (enterpriseSubscriptions[walletAddress]) {
    // If it exists but is expired or inactive, reactivate it
    const existing = enterpriseSubscriptions[walletAddress];
    if (!existing.active || existing.endTime < new Date()) {
      existing.active = true;
      existing.startTime = new Date();
      existing.endTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      existing.totalPaid = (parseFloat(existing.totalPaid) + 20000000).toString();
    }
    
    // Record the transaction on the Flare Network
    return await recordTransactionOnFlare(
      walletAddress,
      'ENTERPRISE_SUBSCRIPTION_RENEWAL',
      {
        startTime: existing.startTime,
        endTime: existing.endTime,
        amount: "20,000,000 FLR"
      }
    );
  }
  
  // Create a new subscription
  const subscription: EnterpriseSubscription = {
    address: walletAddress,
    startTime: new Date(),
    endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    active: true,
    totalPaid: "20,000,000"
  };
  
  // Store the subscription
  enterpriseSubscriptions[walletAddress] = subscription;
  
  // Record the transaction on the Flare Network
  return await recordTransactionOnFlare(
    walletAddress,
    'ENTERPRISE_SUBSCRIPTION',
    {
      startTime: subscription.startTime,
      endTime: subscription.endTime,
      amount: "20,000,000 FLR"
    }
  );
}

/**
 * Get all Flare transactions related to enterprise services
 * @returns Array of Flare transactions
 */
export async function getEnterpriseTransactions(): Promise<FlareTransaction[]> {
  return flareEnterpriseTransactions;
}