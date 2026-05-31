import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { contactGroupsTable } from "./contacts";
import { templatesTable } from "./templates";
import { sessionsTable } from "./sessions";

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  templateId: integer("template_id").references(() => templatesTable.id, { onDelete: "set null" }),
  contactGroupId: integer("contact_group_id").references(() => contactGroupsTable.id, { onDelete: "set null" }),
  sessionId: integer("session_id").references(() => sessionsTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("draft"), // draft | running | paused | completed | failed
  delayMin: integer("delay_min").notNull().default(5),
  delayMax: integer("delay_max").notNull().default(15),
  // Anti-ban settings
  batchSize: integer("batch_size").notNull().default(10),
  batchPauseSeconds: integer("batch_pause_seconds").notNull().default(120),
  enableVariation: boolean("enable_variation").notNull().default(true),
  stopOnBan: boolean("stop_on_ban").notNull().default(true),
  // Counters
  sentCount: integer("sent_count").notNull().default(0),
  deliveredCount: integer("delivered_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  totalCount: integer("total_count").notNull().default(0),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messageLogsTable = pgTable("message_logs", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  phone: text("phone").notNull(),
  contactName: text("contact_name"),
  status: text("status").notNull().default("pending"), // pending | sent | delivered | failed | skipped
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ id: true, createdAt: true, sentCount: true, deliveredCount: true, failedCount: true, totalCount: true, startedAt: true, completedAt: true });
export const insertMessageLogSchema = createInsertSchema(messageLogsTable).omit({ id: true, createdAt: true });

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type InsertMessageLog = z.infer<typeof insertMessageLogSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;
export type MessageLog = typeof messageLogsTable.$inferSelect;
