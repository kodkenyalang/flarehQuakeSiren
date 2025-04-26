import { 
  User, InsertUser, 
  Earthquake, InsertEarthquake,
  Alert, InsertAlert,
  AlertSubscription, InsertAlertSubscription,
  FlareTransaction, InsertFlareTransaction,
  EarthquakeFilters
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Earthquake operations
  getEarthquakes(filters: EarthquakeFilters): Promise<Earthquake[]>;
  getRecentEarthquakes(limit?: number): Promise<Earthquake[]>;
  getEarthquake(id: string): Promise<Earthquake | undefined>;
  createEarthquake(earthquake: InsertEarthquake): Promise<Earthquake>;
  updateEarthquake(id: string, data: Partial<InsertEarthquake>): Promise<Earthquake | undefined>;
  getEarthquakeStats(timeframe: string): Promise<{
    total: number;
    averageMagnitude: number;
    majorCount: number;
    moderateCount: number;
    minorCount: number;
  }>;
  getFlareVerifiedEarthquakes(): Promise<Earthquake[]>;
  
  // Alert operations
  getAlerts(): Promise<Alert[]>;
  getActiveAlerts(): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  updateAlert(id: number, data: Partial<InsertAlert>): Promise<Alert | undefined>;
  
  // Alert Subscription operations
  getAlertSubscriptions(): Promise<AlertSubscription[]>;
  createAlertSubscription(subscription: InsertAlertSubscription): Promise<AlertSubscription>;
  
  // Flare Transaction operations
  getFlareTransactions(): Promise<FlareTransaction[]>;
  createFlareTransaction(transaction: InsertFlareTransaction): Promise<FlareTransaction>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private earthquakes: Map<string, Earthquake>;
  private alerts: Map<number, Alert>;
  private alertSubscriptions: Map<number, AlertSubscription>;
  private flareTransactions: Map<number, FlareTransaction>;
  
  private userIdCounter: number;
  private alertIdCounter: number;
  private subscriptionIdCounter: number;
  private transactionIdCounter: number;
  
  constructor() {
    this.users = new Map();
    this.earthquakes = new Map();
    this.alerts = new Map();
    this.alertSubscriptions = new Map();
    this.flareTransactions = new Map();
    
    this.userIdCounter = 1;
    this.alertIdCounter = 1;
    this.subscriptionIdCounter = 1;
    this.transactionIdCounter = 1;
    
    // Add sample data
    this.initializeSampleData();
  }
  
  private initializeSampleData() {
    // Sample earthquakes
    const sampleEarthquakes: InsertEarthquake[] = [
      {
        place: "San Francisco, CA",
        magnitude: 6.2,
        depth: 12.4,
        latitude: 37.7749,
        longitude: -122.4194,
        time: new Date(Date.now() - 12 * 60 * 1000), // 12 mins ago
        source: "USGS",
        verified: true,
        flareNetworkId: "flare123",
        url: "https://example.com/earthquake/1",
        tsunami: false
      },
      {
        place: "Tokyo, Japan",
        magnitude: 4.8,
        depth: 8.7,
        latitude: 35.6762,
        longitude: 139.6503,
        time: new Date(Date.now() - 47 * 60 * 1000), // 47 mins ago
        source: "JMA",
        verified: true,
        flareNetworkId: "flare456",
        url: "https://example.com/earthquake/2",
        tsunami: false
      },
      {
        place: "Santiago, Chile",
        magnitude: 5.2,
        depth: 15.3,
        latitude: -33.4489,
        longitude: -70.6693,
        time: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        source: "USGS",
        verified: true,
        flareNetworkId: "flare789",
        url: "https://example.com/earthquake/3",
        tsunami: false
      },
      {
        place: "Athens, Greece",
        magnitude: 3.7,
        depth: 5.1,
        latitude: 37.9838,
        longitude: 23.7275,
        time: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        source: "EMSC",
        verified: false,
        url: "https://example.com/earthquake/4",
        tsunami: false
      }
    ];
    
    sampleEarthquakes.forEach((quake, index) => {
      const id = `eq_${index + 1}`;
      this.earthquakes.set(id, {
        ...quake,
        id,
        createdAt: new Date()
      });
    });
    
    // Sample alerts
    const sampleAlerts: InsertAlert[] = [
      {
        message: "Major Earthquake Warning",
        severity: "high",
        magnitude: 6.2,
        location: "San Francisco, CA",
        earthquakeId: "eq_1",
        timestamp: new Date(Date.now() - 12 * 60 * 1000),
        active: true
      },
      {
        message: "Moderate Earthquake Alert",
        severity: "medium",
        magnitude: 4.8,
        location: "Tokyo, Japan",
        earthquakeId: "eq_2",
        timestamp: new Date(Date.now() - 47 * 60 * 1000),
        active: true
      }
    ];
    
    sampleAlerts.forEach(alert => {
      this.createAlert(alert);
    });
  }
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    const apiKey = `api_${Math.random().toString(36).substring(2, 15)}`;
    
    const user: User = { 
      ...insertUser, 
      id, 
      apiKey, 
      createdAt: now 
    };
    
    this.users.set(id, user);
    return user;
  }
  
  // Earthquake operations
  async getEarthquakes(filters: EarthquakeFilters): Promise<Earthquake[]> {
    let earthquakes = Array.from(this.earthquakes.values());
    
    // Apply time range filter
    const now = Date.now();
    let timeFilter: number;
    
    switch (filters.timeRange) {
      case '7d':
        timeFilter = 7 * 24 * 60 * 60 * 1000; // 7 days
        break;
      case '30d':
        timeFilter = 30 * 24 * 60 * 60 * 1000; // 30 days
        break;
      case '1y':
        timeFilter = 365 * 24 * 60 * 60 * 1000; // 1 year
        break;
      case '24h':
      default:
        timeFilter = 24 * 60 * 60 * 1000; // 24 hours
    }
    
    earthquakes = earthquakes.filter(quake => 
      (now - new Date(quake.time).getTime()) <= timeFilter
    );
    
    // Apply magnitude filter
    if (filters.magnitude !== 'all') {
      const minMagnitude = parseFloat(filters.magnitude);
      earthquakes = earthquakes.filter(quake => quake.magnitude >= minMagnitude);
    }
    
    // Apply region filter
    if (filters.region !== 'global') {
      // In a real implementation, we would filter by geographic region
      // This is a simplified version
      switch (filters.region) {
        case 'north_america':
          earthquakes = earthquakes.filter(quake => 
            quake.latitude >= 15 && quake.latitude <= 90 && 
            quake.longitude >= -170 && quake.longitude <= -30
          );
          break;
        case 'south_america':
          earthquakes = earthquakes.filter(quake => 
            quake.latitude >= -60 && quake.latitude <= 15 && 
            quake.longitude >= -90 && quake.longitude <= -30
          );
          break;
        case 'europe':
          earthquakes = earthquakes.filter(quake => 
            quake.latitude >= 35 && quake.latitude <= 75 && 
            quake.longitude >= -25 && quake.longitude <= 45
          );
          break;
        case 'asia':
          earthquakes = earthquakes.filter(quake => 
            quake.latitude >= 0 && quake.latitude <= 80 && 
            quake.longitude >= 45 && quake.longitude <= 180
          );
          break;
        case 'africa':
          earthquakes = earthquakes.filter(quake => 
            quake.latitude >= -40 && quake.latitude <= 40 && 
            quake.longitude >= -20 && quake.longitude <= 55
          );
          break;
        case 'australia':
          earthquakes = earthquakes.filter(quake => 
            quake.latitude >= -50 && quake.latitude <= -10 && 
            quake.longitude >= 110 && quake.longitude <= 180
          );
          break;
      }
    }
    
    // Sort by time, most recent first
    return earthquakes.sort((a, b) => 
      new Date(b.time).getTime() - new Date(a.time).getTime()
    );
  }
  
  async getRecentEarthquakes(limit: number = 10): Promise<Earthquake[]> {
    const earthquakes = Array.from(this.earthquakes.values());
    
    // Sort by time, most recent first
    return earthquakes
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, limit);
  }
  
  async getEarthquake(id: string): Promise<Earthquake | undefined> {
    return this.earthquakes.get(id);
  }
  
  async createEarthquake(insertEarthquake: InsertEarthquake): Promise<Earthquake> {
    const id = `eq_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();
    
    const earthquake: Earthquake = {
      ...insertEarthquake,
      id,
      createdAt: now
    };
    
    this.earthquakes.set(id, earthquake);
    return earthquake;
  }
  
  async updateEarthquake(id: string, data: Partial<InsertEarthquake>): Promise<Earthquake | undefined> {
    const earthquake = this.earthquakes.get(id);
    
    if (!earthquake) {
      return undefined;
    }
    
    const updatedEarthquake: Earthquake = {
      ...earthquake,
      ...data
    };
    
    this.earthquakes.set(id, updatedEarthquake);
    return updatedEarthquake;
  }
  
  async getEarthquakeStats(timeframe: string): Promise<{
    total: number;
    averageMagnitude: number;
    majorCount: number;
    moderateCount: number;
    minorCount: number;
  }> {
    const now = Date.now();
    let timeFilter: number;
    
    switch (timeframe) {
      case '7d':
        timeFilter = 7 * 24 * 60 * 60 * 1000; // 7 days
        break;
      case '30d':
        timeFilter = 30 * 24 * 60 * 60 * 1000; // 30 days
        break;
      case '1y':
        timeFilter = 365 * 24 * 60 * 60 * 1000; // 1 year
        break;
      case '24h':
      default:
        timeFilter = 24 * 60 * 60 * 1000; // 24 hours
    }
    
    const earthquakes = Array.from(this.earthquakes.values()).filter(quake => 
      (now - new Date(quake.time).getTime()) <= timeFilter
    );
    
    const total = earthquakes.length;
    
    if (total === 0) {
      return {
        total: 0,
        averageMagnitude: 0,
        majorCount: 0,
        moderateCount: 0,
        minorCount: 0
      };
    }
    
    const magnitudeSum = earthquakes.reduce((sum, quake) => sum + quake.magnitude, 0);
    const averageMagnitude = magnitudeSum / total;
    
    const majorCount = earthquakes.filter(quake => quake.magnitude >= 6).length;
    const moderateCount = earthquakes.filter(quake => quake.magnitude >= 4 && quake.magnitude < 6).length;
    const minorCount = earthquakes.filter(quake => quake.magnitude < 4).length;
    
    return {
      total,
      averageMagnitude,
      majorCount,
      moderateCount,
      minorCount
    };
  }
  
  async getFlareVerifiedEarthquakes(): Promise<Earthquake[]> {
    const earthquakes = Array.from(this.earthquakes.values());
    return earthquakes.filter(quake => quake.flareNetworkId && quake.verified);
  }
  
  // Alert operations
  async getAlerts(): Promise<Alert[]> {
    return Array.from(this.alerts.values());
  }
  
  async getActiveAlerts(): Promise<Alert[]> {
    const alerts = Array.from(this.alerts.values());
    return alerts.filter(alert => alert.active);
  }
  
  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const id = this.alertIdCounter++;
    
    const alert: Alert = {
      ...insertAlert,
      id
    };
    
    this.alerts.set(id, alert);
    return alert;
  }
  
  async updateAlert(id: number, data: Partial<InsertAlert>): Promise<Alert | undefined> {
    const alert = this.alerts.get(id);
    
    if (!alert) {
      return undefined;
    }
    
    const updatedAlert: Alert = {
      ...alert,
      ...data
    };
    
    this.alerts.set(id, updatedAlert);
    return updatedAlert;
  }
  
  // Alert Subscription operations
  async getAlertSubscriptions(): Promise<AlertSubscription[]> {
    return Array.from(this.alertSubscriptions.values());
  }
  
  async createAlertSubscription(insertSubscription: InsertAlertSubscription): Promise<AlertSubscription> {
    const id = this.subscriptionIdCounter++;
    const now = new Date();
    
    const subscription: AlertSubscription = {
      ...insertSubscription,
      id,
      createdAt: now
    };
    
    this.alertSubscriptions.set(id, subscription);
    return subscription;
  }
  
  // Flare Transaction operations
  async getFlareTransactions(): Promise<FlareTransaction[]> {
    return Array.from(this.flareTransactions.values());
  }
  
  async createFlareTransaction(insertTransaction: InsertFlareTransaction): Promise<FlareTransaction> {
    const id = this.transactionIdCounter++;
    
    const transaction: FlareTransaction = {
      ...insertTransaction,
      id
    };
    
    this.flareTransactions.set(id, transaction);
    return transaction;
  }
}

export const storage = new MemStorage();
