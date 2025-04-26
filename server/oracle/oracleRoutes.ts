import { Request, Response, Router } from "express";
import { z } from "zod";
import {
  validateApiKey,
  createApiKey,
  recordApiRequest,
  getFinancialImpactForEarthquake,
  getEarthquakesWithFinancialImpact,
  RiskLevel
} from "./financialImpactOracle";
import { storage } from "../storage";

// Initialize the router
const router = Router();

// Schema for creating an API key
const createApiKeySchema = z.object({
  organizationName: z.string().min(3, { message: "Organization name must be at least 3 characters" }),
  contactEmail: z.string().email({ message: "Please enter a valid email address" }),
  walletAddress: z.string().min(42, { message: "Please enter a valid wallet address" }),
  durationDays: z.number().int().min(1).max(365),
  requestLimit: z.number().int().min(1).max(100000)
});

// Schema for financial impact request
const financialImpactRequestSchema = z.object({
  earthquakeId: z.string().min(1, { message: "Earthquake ID is required" })
});

// Schema for bulk financial impact request
const bulkFinancialImpactRequestSchema = z.object({
  startTime: z.string().transform(str => new Date(str)),
  endTime: z.string().transform(str => new Date(str)),
  minMagnitude: z.number().optional().default(0)
});

// Schema for market risk assessment
const marketRiskAssessmentSchema = z.object({
  markets: z.array(z.string()).min(1, { message: "At least one market is required" }),
  timeframe: z.enum(["24h", "48h", "7d", "30d"]),
  includeHistorical: z.boolean().optional().default(false)
});

/**
 * Middleware to verify API key
 */
const verifyApiKey = (req: Request, res: Response, next: Function) => {
  const apiKey = req.headers["x-api-key"] as string;
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: "API key is required",
      code: "MISSING_API_KEY"
    });
  }
  
  const validation = validateApiKey(apiKey);
  
  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: "Invalid API key",
      code: "INVALID_API_KEY"
    });
  }
  
  // Add validation result to request for use in route handlers
  (req as any).apiKeyValidation = validation;
  
  // Record the API request
  try {
    const remainingRequests = recordApiRequest(apiKey);
    (req as any).remainingRequests = remainingRequests;
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: "Failed to record API request",
      code: "REQUEST_RECORDING_FAILED"
    });
  }
  
  next();
};

/**
 * Create a new API key
 * This would typically be called after payment is received on the Flare Network
 */
router.post("/api-keys", async (req: Request, res: Response) => {
  try {
    // Simulate blockchain transaction verification
    // In a real implementation, this would verify a transaction on the Flare Network
    const paymentReceived = true;
    const paymentAmount = 20; // 20 FLR tokens
    
    if (!paymentReceived) {
      return res.status(402).json({
        success: false,
        error: "Payment required",
        code: "PAYMENT_REQUIRED",
        requiredAmount: 20
      });
    }
    
    // Validate request body
    const validationResult = createApiKeySchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        validationErrors: validationResult.error.format()
      });
    }
    
    const { organizationName, contactEmail, walletAddress, durationDays, requestLimit } = validationResult.data;
    
    // Create API key
    const { apiKey, subscription } = createApiKey(
      walletAddress,
      organizationName,
      contactEmail,
      durationDays,
      requestLimit
    );
    
    // Return API key
    res.status(201).json({
      success: true,
      apiKey,
      subscription: {
        id: subscription.id,
        organizationName: subscription.organizationName,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        remainingRequests: subscription.remainingRequests
      },
      paymentReceived: {
        amount: paymentAmount,
        currency: "FLR",
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error("Error creating API key:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create API key",
      code: "API_KEY_CREATION_FAILED"
    });
  }
});

/**
 * Get financial impact data for a specific earthquake
 */
router.get("/financial-impact/:earthquakeId", verifyApiKey, async (req: Request, res: Response) => {
  try {
    const earthquakeId = req.params.earthquakeId;
    
    // Get financial impact data
    const impactData = await getFinancialImpactForEarthquake(earthquakeId);
    
    if (!impactData) {
      return res.status(404).json({
        success: false,
        error: "Earthquake not found",
        code: "EARTHQUAKE_NOT_FOUND"
      });
    }
    
    // Return financial impact data
    res.json({
      success: true,
      data: impactData,
      meta: {
        remainingRequests: (req as any).remainingRequests,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error("Error getting financial impact data:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get financial impact data",
      code: "FINANCIAL_IMPACT_RETRIEVAL_FAILED"
    });
  }
});

/**
 * Get financial impact data for multiple earthquakes in a time range
 */
router.post("/bulk-financial-impact", verifyApiKey, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = bulkFinancialImpactRequestSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        validationErrors: validationResult.error.format()
      });
    }
    
    const { startTime, endTime, minMagnitude } = validationResult.data;
    
    // Get earthquakes with financial impact data
    const earthquakes = await getEarthquakesWithFinancialImpact(startTime, endTime);
    
    // Filter by magnitude if specified
    const filteredEarthquakes = minMagnitude 
      ? earthquakes.filter(quake => quake.magnitude >= minMagnitude)
      : earthquakes;
    
    // Return financial impact data
    res.json({
      success: true,
      data: filteredEarthquakes,
      meta: {
        count: filteredEarthquakes.length,
        timeRange: {
          start: startTime,
          end: endTime
        },
        remainingRequests: (req as any).remainingRequests,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error("Error getting bulk financial impact data:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get bulk financial impact data",
      code: "BULK_FINANCIAL_IMPACT_RETRIEVAL_FAILED"
    });
  }
});

/**
 * Get market risk assessment for specific markets
 */
router.post("/market-risk-assessment", verifyApiKey, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = marketRiskAssessmentSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        validationErrors: validationResult.error.format()
      });
    }
    
    const { markets, timeframe, includeHistorical } = validationResult.data;
    
    // Calculate time range based on timeframe
    const endTime = new Date();
    const startTime = new Date();
    
    switch (timeframe) {
      case "24h":
        startTime.setHours(startTime.getHours() - 24);
        break;
      case "48h":
        startTime.setHours(startTime.getHours() - 48);
        break;
      case "7d":
        startTime.setDate(startTime.getDate() - 7);
        break;
      case "30d":
        startTime.setDate(startTime.getDate() - 30);
        break;
    }
    
    // Get earthquakes with financial impact data
    const earthquakes = await getEarthquakesWithFinancialImpact(startTime, endTime);
    
    // Filter to only include earthquakes affecting the specified markets
    const relevantEarthquakes = earthquakes.filter(quake => {
      return quake.financialImpact.affectedMarkets.some(market => 
        markets.includes(market)
      );
    });
    
    // Calculate overall risk level for each market
    const marketRisks = markets.map(market => {
      const affectingEarthquakes = relevantEarthquakes.filter(quake => 
        quake.financialImpact.affectedMarkets.includes(market)
      );
      
      // Calculate maximum risk score
      let maxRiskScore = 0;
      let riskLevel = RiskLevel.LOW;
      
      affectingEarthquakes.forEach(quake => {
        const marketScore = quake.financialImpact.marketSpecificScores[market] || 0;
        if (marketScore > maxRiskScore) {
          maxRiskScore = marketScore;
          
          // Map score to risk level
          if (marketScore < 30) {
            riskLevel = RiskLevel.LOW;
          } else if (marketScore < 60) {
            riskLevel = RiskLevel.MEDIUM;
          } else if (marketScore < 85) {
            riskLevel = RiskLevel.HIGH;
          } else {
            riskLevel = RiskLevel.CRITICAL;
          }
        }
      });
      
      return {
        market,
        riskLevel,
        riskScore: maxRiskScore,
        affectingEarthquakes: affectingEarthquakes.length,
        historical: includeHistorical ? generateHistoricalData(market) : undefined
      };
    });
    
    // Return market risk assessment
    res.json({
      success: true,
      data: {
        marketRisks,
        overallRisk: calculateOverallRisk(marketRisks),
        earthquakes: relevantEarthquakes
      },
      meta: {
        timeRange: {
          start: startTime,
          end: endTime
        },
        remainingRequests: (req as any).remainingRequests,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error("Error getting market risk assessment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get market risk assessment",
      code: "MARKET_RISK_ASSESSMENT_FAILED"
    });
  }
});

/**
 * Get API key information
 */
router.get("/api-key-info", verifyApiKey, async (req: Request, res: Response) => {
  try {
    const validation = (req as any).apiKeyValidation;
    
    res.json({
      success: true,
      data: {
        subscriberId: validation.subscriberId,
        subscriptionId: validation.subscriptionId,
        organization: validation.organization,
        remainingRequests: (req as any).remainingRequests,
        expiresAt: validation.expiresAt
      }
    });
  } catch (error) {
    console.error("Error getting API key information:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get API key information",
      code: "API_KEY_INFO_RETRIEVAL_FAILED"
    });
  }
});

/**
 * Calculate overall risk based on market risks
 * @param marketRisks Market risk assessments
 * @returns Overall risk assessment
 */
function calculateOverallRisk(marketRisks: any[]): { level: RiskLevel; score: number } {
  if (marketRisks.length === 0) {
    return { level: RiskLevel.LOW, score: 0 };
  }
  
  // Find the highest risk level
  let highestRiskLevel = RiskLevel.LOW;
  let totalScore = 0;
  
  marketRisks.forEach(risk => {
    totalScore += risk.riskScore;
    
    // Update highest risk level
    if (risk.riskLevel === RiskLevel.CRITICAL) {
      highestRiskLevel = RiskLevel.CRITICAL;
    } else if (risk.riskLevel === RiskLevel.HIGH && highestRiskLevel !== RiskLevel.CRITICAL) {
      highestRiskLevel = RiskLevel.HIGH;
    } else if (risk.riskLevel === RiskLevel.MEDIUM && 
               highestRiskLevel !== RiskLevel.CRITICAL && 
               highestRiskLevel !== RiskLevel.HIGH) {
      highestRiskLevel = RiskLevel.MEDIUM;
    }
  });
  
  // Calculate average score
  const averageScore = totalScore / marketRisks.length;
  
  return {
    level: highestRiskLevel,
    score: Math.round(averageScore)
  };
}

/**
 * Generate historical risk data for a market (for demonstration purposes)
 * @param market Market name
 * @returns Historical risk data
 */
function generateHistoricalData(market: string): { date: string; riskLevel: RiskLevel; score: number }[] {
  const result: { date: string; riskLevel: RiskLevel; score: number }[] = [];
  const now = new Date();
  
  // Generate data for the past 30 days
  for (let i = 30; i >= 1; i--) {
    const date = new Date();
    date.setDate(now.getDate() - i);
    
    // Generate a random risk score
    const score = Math.floor(Math.random() * 100);
    
    // Map score to risk level
    let riskLevel: RiskLevel;
    if (score < 30) {
      riskLevel = RiskLevel.LOW;
    } else if (score < 60) {
      riskLevel = RiskLevel.MEDIUM;
    } else if (score < 85) {
      riskLevel = RiskLevel.HIGH;
    } else {
      riskLevel = RiskLevel.CRITICAL;
    }
    
    result.push({
      date: date.toISOString().split('T')[0],
      riskLevel,
      score
    });
  }
  
  return result;
}

export default router;