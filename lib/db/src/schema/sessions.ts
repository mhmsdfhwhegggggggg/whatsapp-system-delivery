import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  status: text("status").notNull().default("disconnected"), // disconnected | connecting | connected | banned
  qrCode: text("qr_code"),
  dailySentCount: integer("daily_sent_count").notNull().default(0),
  dailyLimit: integer("daily_limit").notNull().default(50),
  lastResetDate: text("last_reset_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ id: true, createdAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
