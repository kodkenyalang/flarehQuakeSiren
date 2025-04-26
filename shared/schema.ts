import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  apiKey: text("api_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
});

// Earthquake schema
export const earthquakes = pgTable("earthquakes", {
  id: text("id").primaryKey(),
  place: text("place").notNull(),
  magnitude: doublePrecision("magnitude").notNull(),
  depth: doublePrecision("depth").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  time: timestamp("time").notNull(),
  flareNetworkId: text("flare_network_id"),
  verified: boolean("verified").default(false),
  source: text("source").notNull(),
  url: text("url"),
  tsunami: boolean("tsunami").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEarthquakeSchema = createInsertSchema(earthquakes).omit({
  id: true,
  createdAt: true,
});

// Alert schema
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  severity: text("severity").notNull(),
  magnitude: doublePrecision("magnitude"),
  location: text("location"),
  earthquakeId: text("earthquake_id").references(() => earthquakes.id),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  active: boolean("active").default(true),
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
});

// Alert Subscription schema
export const alertSubscriptions = pgTable("alert_subscriptions", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  phoneNumber: text("phone_number"),
  minMagnitude: doublePrecision("min_magnitude").default(4.0),
  regions: text("regions").array(),
  notificationType: text("notification_type").default("all"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAlertSubscriptionSchema = createInsertSchema(alertSubscriptions).omit({
  id: true,
  createdAt: true,
});

// Flare Network Transaction schema
export const flareTransactions = pgTable("flare_transactions", {
  id: serial("id").primaryKey(),
  hash: text("hash").notNull().unique(),
  earthquakeId: text("earthquake_id").references(() => earthquakes.id),
  status: text("status").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertFlareTransactionSchema = createInsertSchema(flareTransactions).omit({
  id: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Earthquake = typeof earthquakes.$inferSelect & { timeAgo?: string };
export type InsertEarthquake = z.infer<typeof insertEarthquakeSchema>;

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

export type AlertSubscription = typeof alertSubscriptions.$inferSelect;
export type InsertAlertSubscription = z.infer<typeof insertAlertSubscriptionSchema>;

export type FlareTransaction = typeof flareTransactions.$inferSelect;
export type InsertFlareTransaction = z.infer<typeof insertFlareTransactionSchema>;

// API request types
export interface EarthquakeFilters {
  timeRange: string;
  magnitude: string;
  region: string;
}
