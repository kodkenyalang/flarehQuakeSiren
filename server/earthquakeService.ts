import { InsertEarthquake, InsertAlert } from "@shared/schema";
import { storage } from "./storage";
import { verifyEarthquakeData } from "./flareNetwork";

/**
 * Fetches earthquake data from external sources
 * In a real implementation, this would fetch from USGS, European Seismic Data, etc.
 */
export async function fetchEarthquakeData() {
  try {
    // Simulate fetching from an external API
    // In a real app, this would be something like:
    // const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');
    // return await response.json();
    
    // This is just a mock response to simulate data
    return {
      features: [
        {
          properties: {
            place: "Northern California",
            mag: 3.5,
            time: Date.now() - 1000 * 60 * 15, // 15 minutes ago
            url: "https://example.com/earthquake/nc1",
            tsunami: 0
          },
          geometry: {
            coordinates: [-121.5, 38.2, 10.2] // longitude, latitude, depth in km
          },
          id: "nc12345"
        },
        {
          properties: {
            place: "Southern Alaska",
            mag: 4.2,
            time: Date.now() - 1000 * 60 * 30, // 30 minutes ago
            url: "https://example.com/earthquake/ak1",
            tsunami: 0
          },
          geometry: {
            coordinates: [-150.3, 61.1, 15.5]
          },
          id: "ak12345"
        }
      ]
    };
  } catch (error) {
    console.error("Error fetching earthquake data:", error);
    return null;
  }
}

/**
 * Parses raw earthquake data into our format
 */
export function parseEarthquakeData(rawData: any): InsertEarthquake[] {
  try {
    return rawData.features.map((feature: any) => {
      const [longitude, latitude, depth] = feature.geometry.coordinates;
      
      return {
        place: feature.properties.place,
        magnitude: feature.properties.mag,
        depth: depth,
        latitude: latitude,
        longitude: longitude,
        time: new Date(feature.properties.time),
        source: "USGS",
        url: feature.properties.url,
        tsunami: feature.properties.tsunami === 1,
        verified: false
      };
    });
  } catch (error) {
    console.error("Error parsing earthquake data:", error);
    return [];
  }
}

/**
 * Processes new earthquakes, adds them to storage, and creates alerts if necessary
 */
export async function processNewEarthquakes(earthquakes: InsertEarthquake[]) {
  const newEarthquakes = [];
  
  for (const quakeData of earthquakes) {
    // Check if earthquake already exists (based on source, location, and time)
    const existingEarthquakes = await storage.getEarthquakes({
      timeRange: "24h",
      magnitude: "all",
      region: "global"
    });
    
    const exists = existingEarthquakes.some(existing => 
      existing.place === quakeData.place &&
      Math.abs(existing.magnitude - quakeData.magnitude) < 0.1 &&
      Math.abs(new Date(existing.time).getTime() - new Date(quakeData.time).getTime()) < 1000 * 60 * 5 // Within 5 minutes
    );
    
    if (!exists) {
      // Add the earthquake to storage
      const earthquake = await storage.createEarthquake(quakeData);
      newEarthquakes.push(earthquake);
      
      // Create an alert if magnitude is significant
      if (quakeData.magnitude >= 4.0) {
        const alertData: InsertAlert = {
          message: quakeData.magnitude >= 6.0 
            ? "Major Earthquake Warning" 
            : "Moderate Earthquake Alert",
          severity: quakeData.magnitude >= 6.0 ? "high" : "medium",
          magnitude: quakeData.magnitude,
          location: quakeData.place,
          earthquakeId: earthquake.id,
          timestamp: new Date(),
          active: true
        };
        
        await storage.createAlert(alertData);
      }
      
      // For significant earthquakes, submit to Flare Network for verification
      if (quakeData.magnitude >= 5.0) {
        try {
          await verifyEarthquakeData(earthquake.id);
        } catch (error) {
          console.error(`Error verifying earthquake ${earthquake.id}:`, error);
        }
      }
    }
  }
  
  return newEarthquakes;
}

/**
 * Calculate how long ago an earthquake occurred in a human-readable format
 */
export function getEarthquakeTimeAgo(time: Date): string {
  const now = new Date();
  const earthquakeTime = new Date(time);
  const diffMs = now.getTime() - earthquakeTime.getTime();
  
  // Convert to seconds
  const diffSec = Math.floor(diffMs / 1000);
  
  // Less than a minute
  if (diffSec < 60) {
    return `${diffSec} seconds ago`;
  }
  
  // Less than an hour
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin} ${diffMin === 1 ? 'min' : 'mins'} ago`;
  }
  
  // Less than a day
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
  }
  
  // Less than a week
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) {
    return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
  }
  
  // Format as date
  return earthquakeTime.toLocaleDateString();
}
