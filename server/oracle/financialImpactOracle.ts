import { Earthquake } from "@shared/schema";
import { storage } from "../storage";

/**
 * FinancialImpactOracle
 * 
 * This service analyzes earthquake data and generates financial impact predictions
 * for financial institutions and businesses. It provides risk assessments for
 * financial markets, exchange rates, and supply chains.
 */

// Risk level enum
export enum RiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL"
}

// Financial impact data structure
export interface FinancialImpactData {
  earthquakeId: string;
  timestamp: Date;
  marketImpactScore: number; // 0-100
  volatilityIndex: number; // 0-100
  affectedMarkets: string[];
  affectedCurrencies: string[];
  riskLevel: RiskLevel;
  marketSpecificScores: Record<string, number>;
  summary: string;
  recommendations: string[];
}

// API Key validation structure
export interface ApiKeyValidation {
  valid: boolean;
  subscriberId?: string;
  subscriptionId?: number;
  organization?: string;
  remainingRequests?: number;
  expiresAt?: Date;
}

// Subscription structure
export interface OracleSubscription {
  id: number;
  apiKey: string;
  subscriber: string;
  organizationName: string;
  contactEmail: string;
  startDate: Date;
  endDate: Date;
  active: boolean;
  remainingRequests: number;
  lastRequestDate?: Date;
}

// In-memory cache of financial impact data
const financialImpactCache = new Map<string, FinancialImpactData>();

// In-memory API key storage (in a real implementation, this would be secured in a database)
const apiKeys = new Map<string, OracleSubscription>();

/**
 * Validate an API key
 * @param apiKey The API key to validate
 * @returns Validation result
 */
export function validateApiKey(apiKey: string): ApiKeyValidation {
  // In a production environment, this would check against the blockchain contract
  // or a secure database
  
  const subscription = apiKeys.get(apiKey);
  
  if (!subscription) {
    return { valid: false };
  }
  
  // Check if subscription is active and not expired
  const now = new Date();
  if (!subscription.active || subscription.endDate < now) {
    return { valid: false };
  }
  
  // Check if there are remaining requests
  if (subscription.remainingRequests <= 0) {
    return { valid: false };
  }
  
  return {
    valid: true,
    subscriberId: subscription.subscriber,
    subscriptionId: subscription.id,
    organization: subscription.organizationName,
    remainingRequests: subscription.remainingRequests,
    expiresAt: subscription.endDate
  };
}

/**
 * Generate financial impact data for an earthquake
 * @param earthquake The earthquake data
 * @returns Financial impact analysis
 */
export function generateFinancialImpactData(earthquake: Earthquake): FinancialImpactData {
  // Check if we have cached data for this earthquake
  const cached = financialImpactCache.get(earthquake.id);
  if (cached) {
    return cached;
  }
  
  // Calculate market impact score based on magnitude, depth, and location
  const magnitudeImpact = calculateMagnitudeImpact(earthquake.magnitude);
  const depthImpact = calculateDepthImpact(earthquake.depth);
  const locationImpact = calculateLocationImpact(earthquake.latitude, earthquake.longitude);
  
  // Overall market impact score (0-100)
  const marketImpactScore = Math.min(100, Math.round(magnitudeImpact * 0.5 + depthImpact * 0.2 + locationImpact * 0.3));
  
  // Determine risk level based on market impact score
  let riskLevel: RiskLevel;
  if (marketImpactScore < 30) {
    riskLevel = RiskLevel.LOW;
  } else if (marketImpactScore < 60) {
    riskLevel = RiskLevel.MEDIUM;
  } else if (marketImpactScore < 85) {
    riskLevel = RiskLevel.HIGH;
  } else {
    riskLevel = RiskLevel.CRITICAL;
  }
  
  // Get affected markets and currencies based on location
  const { affectedMarkets, affectedCurrencies } = getAffectedMarketsAndCurrencies(earthquake.latitude, earthquake.longitude);
  
  // Calculate volatility index (0-100)
  const volatilityIndex = Math.min(100, Math.round(marketImpactScore * 0.8 + Math.random() * 20));
  
  // Generate market-specific scores
  const marketSpecificScores: Record<string, number> = {};
  affectedMarkets.forEach(market => {
    marketSpecificScores[market] = Math.min(100, Math.round(marketImpactScore * (0.7 + Math.random() * 0.5)));
  });
  
  // Generate recommendations based on risk level
  const recommendations = generateRecommendations(riskLevel, affectedMarkets, affectedCurrencies);
  
  // Create summary
  const summary = generateSummary(earthquake, riskLevel, marketImpactScore, volatilityIndex);
  
  // Create financial impact data
  const impactData: FinancialImpactData = {
    earthquakeId: earthquake.id,
    timestamp: new Date(),
    marketImpactScore,
    volatilityIndex,
    affectedMarkets,
    affectedCurrencies,
    riskLevel,
    marketSpecificScores,
    summary,
    recommendations
  };
  
  // Cache the data
  financialImpactCache.set(earthquake.id, impactData);
  
  return impactData;
}

/**
 * Create a new API key for a subscription
 * @param subscriber The subscriber's address
 * @param organizationName The organization name
 * @param contactEmail The contact email
 * @param durationDays Subscription duration in days
 * @param requestLimit Total request limit
 * @returns New API key and subscription details
 */
export function createApiKey(
  subscriber: string,
  organizationName: string,
  contactEmail: string,
  durationDays: number,
  requestLimit: number
): { apiKey: string; subscription: OracleSubscription } {
  // Generate a random API key
  const apiKey = generateRandomApiKey();
  
  // Calculate end date
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + durationDays);
  
  // Create subscription
  const subscriptionId = apiKeys.size + 1;
  const subscription: OracleSubscription = {
    id: subscriptionId,
    apiKey,
    subscriber,
    organizationName,
    contactEmail,
    startDate,
    endDate,
    active: true,
    remainingRequests: requestLimit
  };
  
  // Store API key
  apiKeys.set(apiKey, subscription);
  
  return { apiKey, subscription };
}

/**
 * Record an API request
 * @param apiKey The API key used for the request
 * @returns Updated remaining requests
 */
export function recordApiRequest(apiKey: string): number {
  const subscription = apiKeys.get(apiKey);
  if (!subscription) {
    throw new Error("Invalid API key");
  }
  
  // Decrement remaining requests
  subscription.remainingRequests -= 1;
  subscription.lastRequestDate = new Date();
  
  return subscription.remainingRequests;
}

/**
 * Get all earthquake data with financial impact for a time range
 * @param startTime Start time
 * @param endTime End time
 * @returns Array of earthquakes with financial impact data
 */
export async function getEarthquakesWithFinancialImpact(
  startTime: Date,
  endTime: Date
): Promise<Array<Earthquake & { financialImpact: FinancialImpactData }>> {
  // Get earthquakes from storage
  const earthquakes = await storage.getEarthquakes({
    timeRange: 'custom',
    magnitude: 'all',
    region: 'global'
  });
  
  // Filter by time range
  const filteredEarthquakes = earthquakes.filter(quake => {
    return quake.time >= startTime && quake.time <= endTime;
  });
  
  // Add financial impact data
  return filteredEarthquakes.map(quake => ({
    ...quake,
    financialImpact: generateFinancialImpactData(quake)
  }));
}

/**
 * Get financial impact data for a specific earthquake
 * @param earthquakeId The earthquake ID
 * @returns Financial impact data
 */
export async function getFinancialImpactForEarthquake(
  earthquakeId: string
): Promise<FinancialImpactData | null> {
  // Check cache first
  const cached = financialImpactCache.get(earthquakeId);
  if (cached) {
    return cached;
  }
  
  // Get earthquake from storage
  const earthquake = await storage.getEarthquake(earthquakeId);
  if (!earthquake) {
    return null;
  }
  
  // Generate financial impact data
  return generateFinancialImpactData(earthquake);
}

// Helper functions

/**
 * Calculate impact based on earthquake magnitude
 * @param magnitude Earthquake magnitude
 * @returns Impact score (0-100)
 */
function calculateMagnitudeImpact(magnitude: number): number {
  // Earthquakes below 5.0 have minimal financial impact
  if (magnitude < 5.0) {
    return magnitude * 5;
  }
  
  // Earthquakes 5.0-6.0 have moderate impact
  if (magnitude < 6.0) {
    return 25 + (magnitude - 5.0) * 20;
  }
  
  // Earthquakes 6.0-7.0 have significant impact
  if (magnitude < 7.0) {
    return 45 + (magnitude - 6.0) * 25;
  }
  
  // Earthquakes 7.0+ have severe impact
  return 70 + Math.min(30, (magnitude - 7.0) * 15);
}

/**
 * Calculate impact based on earthquake depth
 * @param depth Earthquake depth in km
 * @returns Impact score (0-100)
 */
function calculateDepthImpact(depth: number): number {
  // Shallower earthquakes generally cause more damage
  if (depth < 10) {
    return 80 + Math.max(0, 10 - depth) * 2;
  }
  
  if (depth < 30) {
    return 60 + Math.max(0, 30 - depth);
  }
  
  if (depth < 70) {
    return 40 + Math.max(0, 70 - depth) / 2;
  }
  
  return Math.max(10, 100 - depth);
}

/**
 * Calculate impact based on earthquake location
 * @param latitude Earthquake latitude
 * @param longitude Earthquake longitude
 * @returns Impact score (0-100)
 */
function calculateLocationImpact(latitude: number, longitude: number): number {
  // Check if the earthquake is near major financial centers or critical infrastructure
  
  // Example: Check if near Japan (Tokyo)
  if (isLocationNearRegion(latitude, longitude, 35.6762, 139.6503, 500)) {
    return 90;
  }
  
  // Example: Check if near US West Coast (San Francisco/Silicon Valley)
  if (isLocationNearRegion(latitude, longitude, 37.7749, -122.4194, 300)) {
    return 85;
  }
  
  // Example: Check if near New York
  if (isLocationNearRegion(latitude, longitude, 40.7128, -74.0060, 300)) {
    return 90;
  }
  
  // Example: Check if near London
  if (isLocationNearRegion(latitude, longitude, 51.5074, -0.1278, 300)) {
    return 85;
  }
  
  // Example: Check if near Hong Kong
  if (isLocationNearRegion(latitude, longitude, 22.3193, 114.1694, 300)) {
    return 90;
  }
  
  // Example: Check if near Singapore
  if (isLocationNearRegion(latitude, longitude, 1.3521, 103.8198, 300)) {
    return 80;
  }
  
  // Default: Moderate impact for other regions
  return 30;
}

/**
 * Check if a location is near a specific region
 * @param lat1 First latitude
 * @param lon1 First longitude
 * @param lat2 Second latitude
 * @param lon2 Second longitude
 * @param radius Radius in km
 * @returns Whether the location is within the radius
 */
function isLocationNearRegion(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radius: number
): boolean {
  // Calculate distance using the Haversine formula
  const R = 6371; // Earth's radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance <= radius;
}

/**
 * Convert degrees to radians
 * @param deg Degrees
 * @returns Radians
 */
function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Get affected markets and currencies based on location
 * @param latitude Earthquake latitude
 * @param longitude Earthquake longitude
 * @returns Affected markets and currencies
 */
function getAffectedMarketsAndCurrencies(
  latitude: number,
  longitude: number
): { affectedMarkets: string[]; affectedCurrencies: string[] } {
  const affectedMarkets: string[] = [];
  const affectedCurrencies: string[] = [];
  
  // Japan region
  if (isLocationNearRegion(latitude, longitude, 35.6762, 139.6503, 800)) {
    affectedMarkets.push('NIKKEI', 'JPX');
    affectedCurrencies.push('JPY');
  }
  
  // US West Coast
  if (isLocationNearRegion(latitude, longitude, 37.7749, -122.4194, 800)) {
    affectedMarkets.push('NASDAQ', 'NYSE', 'SP500');
    affectedCurrencies.push('USD');
  }
  
  // Australia
  if (isLocationNearRegion(latitude, longitude, -33.8688, 151.2093, 800)) {
    affectedMarkets.push('ASX200');
    affectedCurrencies.push('AUD');
  }
  
  // China
  if (isLocationNearRegion(latitude, longitude, 31.2304, 121.4737, 800)) {
    affectedMarkets.push('SSE', 'SZSE');
    affectedCurrencies.push('CNY');
  }
  
  // Add general markets for any significant earthquake
  if (affectedMarkets.length === 0) {
    affectedMarkets.push('GLOBAL_MARKETS');
    affectedCurrencies.push('USD', 'EUR');
  }
  
  return { affectedMarkets, affectedCurrencies };
}

/**
 * Generate recommendations based on risk level
 * @param riskLevel Risk level
 * @param affectedMarkets Affected markets
 * @param affectedCurrencies Affected currencies
 * @returns Recommendations array
 */
function generateRecommendations(
  riskLevel: RiskLevel,
  affectedMarkets: string[],
  affectedCurrencies: string[]
): string[] {
  const recommendations: string[] = [];
  
  switch (riskLevel) {
    case RiskLevel.LOW:
      recommendations.push(
        "Monitor situation for potential supply chain disruptions in affected regions.",
        "No immediate market action required, continue normal operations."
      );
      break;
      
    case RiskLevel.MEDIUM:
      recommendations.push(
        `Monitor ${affectedMarkets.join(', ')} for increased volatility in the next 24-48 hours.`,
        `Consider hedging exposure to ${affectedCurrencies.join(', ')} in the short term.`,
        "Review supply chain resilience in affected regions."
      );
      break;
      
    case RiskLevel.HIGH:
      recommendations.push(
        `Anticipate significant volatility in ${affectedMarkets.join(', ')} for 3-5 days.`,
        `Implement hedging strategies for ${affectedCurrencies.join(', ')} positions.`,
        "Activate business continuity plans for operations in affected regions.",
        "Consider temporary portfolio reallocation to reduce risk exposure."
      );
      break;
      
    case RiskLevel.CRITICAL:
      recommendations.push(
        `Immediate action required to mitigate exposure to ${affectedMarkets.join(', ')}.`,
        `Implement maximum hedging for ${affectedCurrencies.join(', ')} positions.`,
        "Activate emergency business continuity protocols.",
        "Prepare for potential market circuit breakers and trading halts.",
        "Set up crisis management team to monitor developments."
      );
      break;
  }
  
  return recommendations;
}

/**
 * Generate a summary of the financial impact
 * @param earthquake Earthquake data
 * @param riskLevel Risk level
 * @param marketImpactScore Market impact score
 * @param volatilityIndex Volatility index
 * @returns Summary string
 */
function generateSummary(
  earthquake: Earthquake,
  riskLevel: RiskLevel,
  marketImpactScore: number,
  volatilityIndex: number
): string {
  return `${riskLevel} financial impact risk from M${earthquake.magnitude} earthquake near ${earthquake.place}. Market impact score: ${marketImpactScore}/100, Expected volatility index: ${volatilityIndex}/100. Monitor markets for potential disruptions and implement appropriate risk management strategies.`;
}

/**
 * Generate a random API key
 * @returns Random API key
 */
function generateRandomApiKey(): string {
  return 'qs_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}