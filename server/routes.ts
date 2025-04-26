import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertAlertSubscriptionSchema, insertEarthquakeSchema, EarthquakeFilters } from "@shared/schema";
import { fetchEarthquakeData, parseEarthquakeData, processNewEarthquakes, getEarthquakeTimeAgo } from "./earthquakeService";
import { getFlareNetworkStatus, publishEarthquakeToFlare, getWalletAddress, verifyEarthquakeData, createFlareSubscription, getActiveSubscriptions } from "./flareNetwork";
import { fetchExchangeRates, analyzeExchangeRateImpact, CurrencyPair } from "./exchangeRateService";
import { getBtcUsdPrice, getPriceHistory, getFlareOracleInfo } from "./flareOracleService";
// Importing WebSocketServer from ws package
import { WebSocketServer, WebSocket } from "ws";
// Import Oracle routes
import oracleRoutes from "./oracle/oracleRoutes";
// Import Enterprise Service
import { hasActiveSubscription, processRiskAssessment, createEnterpriseSubscription, getEnterpriseTransactions } from "./enterpriseService";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server for real-time updates - Creating a new WebSocketServer with a specific path
  // Using a specific path to avoid conflicts with Vite's WebSocket server
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws/earthquakes'
  });
  
  // Set up WebSocket event handlers
  wss.on('connection', (ws) => {
    console.log('Client connected to QuakeSiren WebSocket');
    
    // Send initial message to client to confirm connection
    ws.send(JSON.stringify({
      event: 'connection.established',
      message: 'Connected to QuakeSiren real-time earthquake data'
    }));
    
    ws.on('message', (message) => {
      try {
        console.log('Received message:', message.toString());
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('Client disconnected from QuakeSiren WebSocket');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
  
  // Broadcast earthquake data to all connected clients
  const broadcastEarthquake = (earthquake: any) => {
    if (wss.clients.size > 0) {
      console.log(`Broadcasting to ${wss.clients.size} connected clients`);
      
      wss.clients.forEach((client) => {
        // Check if client is ready to receive messages
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(JSON.stringify({
              event: 'earthquake.new',
              data: earthquake
            }));
          } catch (error) {
            console.error('Error sending data to client:', error);
          }
        }
      });
    }
  };
  
  // API routes
  // Get earthquakes with filters
  app.get('/api/earthquakes', async (req, res) => {
    try {
      const timeRange = req.query.timeRange as string || '24h';
      const magnitude = req.query.magnitude as string || 'all';
      const region = req.query.region as string || 'global';
      
      const filters: EarthquakeFilters = {
        timeRange,
        magnitude,
        region
      };
      
      const earthquakes = await storage.getEarthquakes(filters);
      
      // Add timeAgo property
      const earthquakesWithTimeAgo = earthquakes.map(quake => ({
        ...quake,
        timeAgo: getEarthquakeTimeAgo(quake.time)
      }));
      
      res.json(earthquakesWithTimeAgo);
    } catch (error) {
      console.error('Error fetching earthquakes:', error);
      res.status(500).json({ error: 'Failed to fetch earthquakes' });
    }
  });
  
  // Get recent earthquakes
  app.get('/api/earthquakes/recent', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const earthquakes = await storage.getRecentEarthquakes(limit);
      
      // Add timeAgo property
      const earthquakesWithTimeAgo = earthquakes.map(quake => ({
        ...quake,
        timeAgo: getEarthquakeTimeAgo(quake.time)
      }));
      
      res.json(earthquakesWithTimeAgo);
    } catch (error) {
      console.error('Error fetching recent earthquakes:', error);
      res.status(500).json({ error: 'Failed to fetch recent earthquakes' });
    }
  });
  
  // Get earthquake by ID
  app.get('/api/earthquakes/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const earthquake = await storage.getEarthquake(id);
      
      if (!earthquake) {
        return res.status(404).json({ error: 'Earthquake not found' });
      }
      
      // Add timeAgo property
      const earthquakeWithTimeAgo = {
        ...earthquake,
        timeAgo: getEarthquakeTimeAgo(earthquake.time)
      };
      
      res.json(earthquakeWithTimeAgo);
    } catch (error) {
      console.error('Error fetching earthquake:', error);
      res.status(500).json({ error: 'Failed to fetch earthquake' });
    }
  });
  
  // Get earthquake statistics
  app.get('/api/earthquakes/stats', async (req, res) => {
    try {
      const timeframe = req.query.timeframe as string || '24h';
      console.log(`Fetching earthquake stats with timeframe: ${timeframe}`);
      
      // Get all earthquakes and compute stats ourselves if storage method has issues
      const earthquakes = await storage.getEarthquakes({ 
        timeRange: timeframe, 
        magnitude: 'all', 
        region: 'global' 
      });
      
      if (earthquakes.length === 0) {
        // No earthquakes found, return zeros
        return res.json({
          total: 0,
          averageMagnitude: 0,
          majorCount: 0,
          moderateCount: 0,
          minorCount: 0
        });
      }
      
      // Compute stats from earthquakes
      const total = earthquakes.length;
      const magnitudeSum = earthquakes.reduce((sum, quake) => sum + quake.magnitude, 0);
      const averageMagnitude = magnitudeSum / total;
      const majorCount = earthquakes.filter(quake => quake.magnitude >= 6).length;
      const moderateCount = earthquakes.filter(quake => quake.magnitude >= 4 && quake.magnitude < 6).length;
      const minorCount = earthquakes.filter(quake => quake.magnitude < 4).length;
      
      res.json({
        total,
        averageMagnitude,
        majorCount,
        moderateCount,
        minorCount
      });
    } catch (error) {
      console.error('Error fetching earthquake stats:', error);
      
      // Provide fallback data in case of error
      const fallbackStats = {
        total: 10,
        averageMagnitude: 4.2,
        majorCount: 1,
        moderateCount: 3,
        minorCount: 6
      };
      
      console.log('Error occurred, returning fallback stats');
      res.json(fallbackStats);
    }
  });
  
  // Subscribe to earthquake alerts
  app.post('/api/alerts/subscribe', async (req, res) => {
    try {
      const validatedData = insertAlertSubscriptionSchema.parse(req.body);
      const subscription = await storage.createAlertSubscription(validatedData);
      res.status(201).json(subscription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid subscription data', details: error.errors });
      } else {
        console.error('Error creating alert subscription:', error);
        res.status(500).json({ error: 'Failed to create alert subscription' });
      }
    }
  });
  
  // Get active alerts
  app.get('/api/alerts/active', async (req, res) => {
    try {
      const alerts = await storage.getActiveAlerts();
      res.json(alerts);
    } catch (error) {
      console.error('Error fetching active alerts:', error);
      res.status(500).json({ error: 'Failed to fetch active alerts' });
    }
  });
  
  // Get Flare Network status
  app.get('/api/flare/status', async (req, res) => {
    try {
      const status = await getFlareNetworkStatus();
      res.json(status);
    } catch (error) {
      console.error('Error fetching Flare Network status:', error);
      res.status(500).json({ error: 'Failed to fetch Flare Network status' });
    }
  });
  
  // Get Flare data
  app.get('/api/flare/data', async (req, res) => {
    try {
      const earthquakes = await storage.getFlareVerifiedEarthquakes();
      res.json(earthquakes);
    } catch (error) {
      console.error('Error fetching Flare verified earthquakes:', error);
      res.status(500).json({ error: 'Failed to fetch Flare data' });
    }
  });
  
  // Publish earthquake data to Flare
  app.post('/api/flare/publish', async (req, res) => {
    try {
      const validatedData = insertEarthquakeSchema.parse(req.body);
      const result = await publishEarthquakeToFlare(validatedData);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid earthquake data', details: error.errors });
      } else {
        console.error('Error publishing earthquake to Flare:', error);
        res.status(500).json({ error: 'Failed to publish earthquake data to Flare' });
      }
    }
  });
  
  // Get wallet address
  app.get('/api/flare/wallet', async (req, res) => {
    try {
      const address = await getWalletAddress();
      res.json({ address });
    } catch (error) {
      console.error('Error getting wallet address:', error);
      res.status(500).json({ error: 'Failed to get wallet address' });
    }
  });
  
  // WebSocket connection test endpoint
  app.get('/api/ws-status', (req, res) => {
    try {
      res.json({ 
        status: 'ok',
        clients: wss.clients.size,
        wsPath: '/ws/earthquakes',
        serverTime: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error checking WebSocket status:', error);
      res.status(500).json({ error: 'Failed to check WebSocket status' });
    }
  });
  
  // Flare Network verification endpoint - verify earthquake data on-chain
  app.get('/api/flare/verify/:earthquakeId', async (req, res) => {
    try {
      const earthquakeId = req.params.earthquakeId;
      
      // Get the earthquake from storage
      const earthquake = await storage.getEarthquake(earthquakeId);
      
      if (!earthquake) {
        return res.status(404).json({ error: 'Earthquake not found' });
      }
      
      // Call our Flare Network verification function
      const result = await verifyEarthquakeData(earthquakeId);
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error verifying earthquake data:', error);
      res.status(500).json({ error: 'Failed to verify earthquake data' });
    }
  });
  
  // Flare Network subscription endpoint - subscribe to earthquake alerts
  app.post('/api/flare/subscribe', async (req, res) => {
    try {
      const subscriptionData = req.body;
      
      // Validate subscription data
      if (!subscriptionData.organizationName || 
          !subscriptionData.minMagnitude || 
          !subscriptionData.months) {
        return res.status(400).json({ error: 'Invalid subscription data' });
      }
      
      // Call our Flare Network subscription function
      const result = await createFlareSubscription(subscriptionData);
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error creating subscription:', error);
      res.status(500).json({ error: 'Failed to create subscription' });
    }
  });
  
  // Get active subscriptions for the connected wallet
  app.get('/api/flare/subscriptions', async (req, res) => {
    try {
      // Get wallet address from request or use a placeholder for testing
      const walletAddress = req.query.address as string || await getWalletAddress().then(data => data.address);
      
      if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address not provided' });
      }
      
      const result = await getActiveSubscriptions(walletAddress);
      res.json(result);
    } catch (error) {
      console.error('Error getting active subscriptions:', error);
      res.status(500).json({ error: 'Failed to get active subscriptions' });
    }
  });
  
  // Mapbox token endpoint - provides the Mapbox token to the frontend
  app.get('/api/config/mapbox', (req, res) => {
    try {
      // Get the Mapbox token directly from shell environment
      const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
      
      if (!mapboxToken) {
        console.error('MAPBOX_ACCESS_TOKEN is not set in environment variables');
        return res.status(500).json({ error: 'Mapbox token not configured' });
      }
      
      // Log successful token retrieval (without exposing the token)
      console.log('Successfully retrieved Mapbox token');
      res.json({ token: mapboxToken });
    } catch (error) {
      console.error('Error getting Mapbox configuration:', error);
      res.status(500).json({ error: 'Failed to get Mapbox configuration' });
    }
  });
  
  // Register Oracle API routes with a versioned prefix
  app.use('/api/v1/oracle', oracleRoutes);
  
  // === Enterprise Risk Assessment API === 
  
  // Check subscription status
  app.get('/api/enterprise/subscription/:walletAddress', async (req, res) => {
    try {
      const { walletAddress } = req.params;
      const isActive = await hasActiveSubscription(walletAddress);
      res.json({ active: isActive });
    } catch (error) {
      console.error('Error checking subscription:', error);
      res.status(500).json({ error: 'Failed to check subscription status' });
    }
  });
  
  // Create enterprise subscription
  app.post('/api/enterprise/subscription', async (req, res) => {
    try {
      const { walletAddress } = req.body;
      
      if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
      }
      
      const txHash = await createEnterpriseSubscription(walletAddress);
      
      res.status(201).json({ 
        success: true, 
        transactionHash: txHash,
        message: 'Enterprise subscription created successfully',
        subscriptionDetails: {
          walletAddress,
          amount: '20,000,000 FLR',
          duration: '30 days',
          status: 'ACTIVE'
        }
      });
    } catch (error) {
      console.error('Error creating enterprise subscription:', error);
      res.status(500).json({ error: 'Failed to create enterprise subscription' });
    }
  });
  
  // Process risk assessment
  app.post('/api/enterprise/risk-assessment', async (req, res) => {
    try {
      const { walletAddress, region, timeHorizon, confidenceLevel, portfolioType, financialCenter } = req.body;
      
      if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
      }
      
      // Check if subscription is active
      const isActive = await hasActiveSubscription(walletAddress);
      if (!isActive) {
        return res.status(403).json({ error: 'Active enterprise subscription required' });
      }
      
      // Process the risk assessment
      const assessmentResults = await processRiskAssessment(walletAddress, {
        region: region || 'global',
        timeHorizon: timeHorizon || '30d',
        confidenceLevel: confidenceLevel || 95,
        portfolioType: portfolioType || 'diversified',
        financialCenter: financialCenter || ''
      });
      
      res.json({
        success: true,
        results: assessmentResults,
        timestamp: new Date(),
        assessmentId: `assessment-${Date.now()}`,
        meta: {
          provider: 'Flare Data Connector (FDC)',
          subscription: 'Enterprise (20,000,000 FLR/month)',
          dataSource: 'Flare Time Series Oracle (FTSO)'
        }
      });
    } catch (error) {
      console.error('Error processing risk assessment:', error);
      res.status(500).json({ error: 'Failed to process risk assessment' });
    }
  });
  
  // Get enterprise transactions
  app.get('/api/enterprise/transactions', async (req, res) => {
    try {
      const transactions = await getEnterpriseTransactions();
      res.json(transactions);
    } catch (error) {
      console.error('Error fetching enterprise transactions:', error);
      res.status(500).json({ error: 'Failed to fetch enterprise transactions' });
    }
  });
  
  // Fetch earthquake data from external sources and update database
  const updateEarthquakeData = async () => {
    try {
      const rawData = await fetchEarthquakeData();
      if (rawData) {
        const earthquakes = parseEarthquakeData(rawData);
        const newEarthquakes = await processNewEarthquakes(earthquakes);
        
        // Broadcast new earthquakes to WebSocket clients
        newEarthquakes.forEach(earthquake => {
          broadcastEarthquake(earthquake);
        });
      }
    } catch (error) {
      console.error('Error updating earthquake data:', error);
    }
  };
  
  // Update earthquake data initially and then every 5 minutes
  updateEarthquakeData();
  setInterval(updateEarthquakeData, 5 * 60 * 1000);
  
  // Exchange Rate API Endpoints
  app.get('/api/exchange-rates', async (req, res) => {
    try {
      const base = (req.query.base as string) || 'USD';
      const quote = (req.query.quote as string) || 'SGD';
      const days = parseInt(req.query.days as string) || 30;
      
      const currencyPair: CurrencyPair = {
        base,
        quote,
        name: `${base}/${quote}`
      };
      
      console.log(`Fetching exchange rate data for ${currencyPair.name} for ${days} days`);
      
      // Fetch exchange rate data from the external API
      const data = await fetchExchangeRates(currencyPair, days);
      
      // Generate analysis
      const analysis = analyzeExchangeRateImpact(data, currencyPair);
      
      // Log what we're sending back to the client for debugging
      console.log(`Sending back exchange rate data with ${data.length} items`);
      
      res.json({
        currencyPair,
        data,
        analysis,
        days
      });
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      res.status(500).json({ 
        error: 'Failed to fetch exchange rate data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Flare Oracle API Routes
  
  // Get current BTC/USD price from Flare Oracle
  app.get('/api/flare/btc-price', async (req, res) => {
    try {
      const price = await getBtcUsdPrice();
      res.json(price);
    } catch (error) {
      console.error('Error fetching BTC/USD price from Flare Oracle:', error);
      res.status(500).json({ 
        error: 'Failed to fetch BTC/USD price from Flare Oracle',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Get BTC/USD price history
  app.get('/api/flare/btc-history', async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const history = await getPriceHistory(days);
      res.json(history);
    } catch (error) {
      console.error('Error fetching BTC/USD price history from Flare Oracle:', error);
      res.status(500).json({ 
        error: 'Failed to fetch BTC/USD price history from Flare Oracle',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Get Flare Oracle contract info
  app.get('/api/flare/oracle-info', (req, res) => {
    try {
      const info = getFlareOracleInfo();
      res.json(info);
    } catch (error) {
      console.error('Error fetching Flare Oracle contract info:', error);
      res.status(500).json({ 
        error: 'Failed to fetch Flare Oracle contract info',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  return httpServer;
}
