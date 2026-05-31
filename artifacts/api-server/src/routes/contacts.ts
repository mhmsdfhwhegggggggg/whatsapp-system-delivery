import { Router } from "express";
import { db } from "@workspace/db";
import { contactGroupsTable, contactsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  CreateContactGroupBody,
  GetContactGroupParams,
  DeleteContactGroupParams,
  ListContactsParams,
  AddContactParams,
  AddContactBody,
  ImportContactsParams,
  ImportContactsBody,
  DeleteContactParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/contact-groups", async (req, res) => {
  try {
    const groups = await db.select().from(contactGroupsTable).orderBy(contactGroupsTable.createdAt);
    const counts = await db
      .select({ groupId: contactsTable.groupId, count: sql<number>`count(*)::int` })
      .from(contactsTable)
      .groupBy(contactsTable.groupId);
    const countMap = Object.fromEntries(counts.map((c) => [c.groupId, c.count]));
    res.json(groups.map((g) => ({ ...g, contactCount: countMap[g.id] ?? 0 })));
  } catch (err) {
    req.log.error({ err }, "Failed to list contact groups");
    res.status(500).json({ error: "Failed to list contact groups" });
  }
});

router.post("/contact-groups", async (req, res) => {
  const parsed = CreateContactGroupBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [group] = await db
      .insert(contactGroupsTable)
      .values({ name: parsed.data.name, description: parsed.data.description ?? null })
      .returning();
    res.status(201).json({ ...group, contactCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to create contact group");
    res.status(500).json({ error: "Failed to create contact group" });
  }
});

router.get("/contact-groups/:id", async (req, res) => {
  const parsed = GetContactGroupParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [group] = await db.select().from(contactGroupsTable).where(eq(contactGroupsTable.id, parsed.data.id));
    if (!group) { res.status(404).json({ error: "Not found" }); return; }
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contactsTable)
      .where(eq(contactsTable.groupId, parsed.data.id));
    res.json({ ...group, contactCount: countRow?.count ?? 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to get contact group");
    res.status(500).json({ error: "Failed to get contact group" });
  }
});

router.delete("/contact-groups/:id", async (req, res) => {
  const parsed = DeleteContactGroupParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.delete(contactGroupsTable).where(eq(contactGroupsTable.id, parsed.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete contact group");
    res.status(500).json({ error: "Failed to delete contact group" });
  }
});

router.get("/contact-groups/:id/contacts", async (req, res) => {
  const parsed = ListContactsParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const contacts = await db
      .select()
      .from(contactsTable)
      .where(eq(contactsTable.groupId, parsed.data.id))
      .orderBy(contactsTable.createdAt);
    res.json(contacts);
  } catch (err) {
    req.log.error({ err }, "Failed to list contacts");
    res.status(500).json({ error: "Failed to list contacts" });
  }
});

router.post("/contact-groups/:id/contacts", async (req, res) => {
  const paramsParsed = AddContactParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed = AddContactBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const [contact] = await db
      .insert(contactsTable)
      .values({
        groupId: paramsParsed.data.id,
        phone: bodyParsed.data.phone,
        name: bodyParsed.data.name ?? null,
        variables: (bodyParsed.data.variables as Record<string, string>) ?? {},
      })
      .returning();
    res.status(201).json(contact);
  } catch (err) {
    req.log.error({ err }, "Failed to add contact");
    res.status(500).json({ error: "Failed to add contact" });
  }
});

router.post("/contact-groups/:id/import", async (req, res) => {
  const paramsParsed = ImportContactsParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed = ImportContactsBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const groupId = paramsParsed.data.id;
    const lines = bodyParsed.data.csvData.trim().split("\n").filter(Boolean);
    if (lines.length < 2) {
      res.status(400).json({ error: "CSV must have a header row and at least one data row" });
      return;
    }
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const phoneIdx = headers.indexOf("phone");
    const nameIdx = headers.indexOf("name");
    if (phoneIdx === -1) {
      res.status(400).json({ error: "CSV must have a 'phone' column" });
      return;
    }

    // Get existing phones in this group to avoid duplicates
    const existing = await db
      .select({ phone: contactsTable.phone })
      .from(contactsTable)
      .where(eq(contactsTable.groupId, groupId));
    const existingPhones = new Set(existing.map((c) => c.phone));

    let imported = 0;
    let duplicates = 0;
    let errors = 0;
    const toInsert = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      const phone = cols[phoneIdx];
      if (!phone) { errors++; continue; }
      if (existingPhones.has(phone)) { duplicates++; continue; }
      existingPhones.add(phone);
      const name = nameIdx !== -1 ? cols[nameIdx] ?? null : null;
      const variables: Record<string, string> = {};
      headers.forEach((h, idx) => {
        if (h !== "phone" && h !== "name" && cols[idx]) {
          variables[h] = cols[idx];
        }
      });
      toInsert.push({ groupId, phone, name, variables });
    }

    if (toInsert.length > 0) {
      await db.insert(contactsTable).values(toInsert);
      imported = toInsert.length;
    }

    res.json({ imported, duplicates, errors });
  } catch (err) {
    req.log.error({ err }, "Failed to import contacts");
    res.status(500).json({ error: "Failed to import contacts" });
  }
});

router.delete("/contacts/:id", async (req, res) => {
  const parsed = DeleteContactParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.delete(contactsTable).where(eq(contactsTable.id, parsed.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete contact");
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

export default router;
