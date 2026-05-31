import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contactGroupsTable = pgTable("contact_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contactsTable = pgTable("contacts", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => contactGroupsTable.id, { onDelete: "cascade" }),
  phone: text("phone").notNull(),
  name: text("name"),
  variables: jsonb("variables").$type<Record<string, string>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertContactGroupSchema = createInsertSchema(contactGroupsTable).omit({ id: true, createdAt: true });
export const insertContactSchema = createInsertSchema(contactsTable).omit({ id: true, createdAt: true });

export type InsertContactGroup = z.infer<typeof insertContactGroupSchema>;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type ContactGroup = typeof contactGroupsTable.$inferSelect;
export type Contact = typeof contactsTable.$inferSelect;
