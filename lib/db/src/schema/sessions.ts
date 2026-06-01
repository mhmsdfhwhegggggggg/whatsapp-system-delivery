import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./users";

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  status: text("status").notNull().default("disconnected"), // disconnected | connecting | connected | banned
  qrCode: text("qr_code"),
  dailySentCount: integer("daily_sent_count").notNull().default(0),
  dailyLimit: integer("daily_limit").notNull().default(50),
  lastResetDate: text("last_reset_date"),
  proxyUrl: text("proxy_url"), // e.g. socks5://user:pass@host:port
  // Warm-up system
  warmupMode: boolean("warmup_mode").notNull().default(true),
  warmupDay: integer("warmup_day").notNull().default(1),
  // Send time window (24h format, e.g. 9 = 9am, 21 = 9pm)
  sendHourStart: integer("send_hour_start").notNull().default(9),
  sendHourEnd: integer("send_hour_end").notNull().default(21),
  // Baileys auth state stored as JSON
  authState: text("auth_state"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const blacklistTable = pgTable("blacklist", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ id: true, createdAt: true });
export const insertBlacklistSchema = createInsertSchema(blacklistTable).omit({ id: true, createdAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
export type Blacklist = typeof blacklistTable.$inferSelect;
