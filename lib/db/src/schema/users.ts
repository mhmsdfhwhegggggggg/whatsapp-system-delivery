import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  role: text("role").notNull().default("user"), // user | admin
  status: text("status").notNull().default("active"), // active | suspended
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  planName: text("plan_name").notNull().default("monthly"),
  status: text("status").notNull().default("inactive"), // active | inactive | expired
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  maxSessions: integer("max_sessions").notNull().default(1),
  maxDailyMessages: integer("max_daily_messages").notNull().default(100),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ id: true, updatedAt: true });

export type User = typeof usersTable.$inferSelect;
export type Subscription = typeof subscriptionsTable.$inferSelect;
