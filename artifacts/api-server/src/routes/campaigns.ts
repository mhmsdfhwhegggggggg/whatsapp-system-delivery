import { Router } from "express";
import { db } from "@workspace/db";
import { campaignsTable, messageLogsTable, contactsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import {
  CreateCampaignBody,
  GetCampaignParams,
  UpdateCampaignParams,
  UpdateCampaignBody,
  DeleteCampaignParams,
  StartCampaignParams,
  PauseCampaignParams,
  ResumeCampaignParams,
  ListCampaignMessagesParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/campaigns", async (req, res) => {
  try {
    const campaigns = await db.select().from(campaignsTable).orderBy(campaignsTable.createdAt);
    res.json(campaigns);
  } catch (err) {
    req.log.error({ err }, "Failed to list campaigns");
    res.status(500).json({ error: "Failed to list campaigns" });
  }
});

router.post("/campaigns", async (req, res) => {
  const parsed = CreateCampaignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [campaign] = await db
      .insert(campaignsTable)
      .values({
        name: parsed.data.name,
        templateId: parsed.data.templateId ?? null,
        contactGroupId: parsed.data.contactGroupId ?? null,
        sessionId: parsed.data.sessionId ?? null,
        delayMin: parsed.data.delayMin ?? 5,
        delayMax: parsed.data.delayMax ?? 15,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
        status: "draft",
      })
      .returning();
    res.status(201).json(campaign);
  } catch (err) {
    req.log.error({ err }, "Failed to create campaign");
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

router.get("/campaigns/:id", async (req, res) => {
  const parsed = GetCampaignParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, parsed.data.id));
    if (!campaign) { res.status(404).json({ error: "Not found" }); return; }
    res.json(campaign);
  } catch (err) {
    req.log.error({ err }, "Failed to get campaign");
    res.status(500).json({ error: "Failed to get campaign" });
  }
});

router.patch("/campaigns/:id", async (req, res) => {
  const paramsParsed = UpdateCampaignParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed = UpdateCampaignBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const updates: Partial<typeof campaignsTable.$inferInsert> = {};
    const d = bodyParsed.data;
    if (d.name !== undefined) updates.name = d.name;
    if (d.templateId !== undefined) updates.templateId = d.templateId;
    if (d.contactGroupId !== undefined) updates.contactGroupId = d.contactGroupId;
    if (d.sessionId !== undefined) updates.sessionId = d.sessionId;
    if (d.delayMin !== undefined) updates.delayMin = d.delayMin;
    if (d.delayMax !== undefined) updates.delayMax = d.delayMax;
    if (d.scheduledAt !== undefined) updates.scheduledAt = new Date(d.scheduledAt);

    const [campaign] = await db
      .update(campaignsTable)
      .set(updates)
      .where(eq(campaignsTable.id, paramsParsed.data.id))
      .returning();
    if (!campaign) { res.status(404).json({ error: "Not found" }); return; }
    res.json(campaign);
  } catch (err) {
    req.log.error({ err }, "Failed to update campaign");
    res.status(500).json({ error: "Failed to update campaign" });
  }
});

router.delete("/campaigns/:id", async (req, res) => {
  const parsed = DeleteCampaignParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.delete(campaignsTable).where(eq(campaignsTable.id, parsed.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete campaign");
    res.status(500).json({ error: "Failed to delete campaign" });
  }
});

router.post("/campaigns/:id/start", async (req, res) => {
  const parsed = StartCampaignParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, parsed.data.id));
    if (!campaign) { res.status(404).json({ error: "Not found" }); return; }
    if (!campaign.contactGroupId) {
      res.status(400).json({ error: "Campaign must have a contact group" });
      return;
    }

    // Build message log entries from contacts
    const contacts = await db
      .select()
      .from(contactsTable)
      .where(eq(contactsTable.groupId, campaign.contactGroupId));

    if (contacts.length === 0) {
      res.status(400).json({ error: "Contact group has no contacts" });
      return;
    }

    // Create pending message logs
    await db.insert(messageLogsTable).values(
      contacts.map((c) => ({
        campaignId: campaign.id,
        phone: c.phone,
        contactName: c.name ?? null,
        status: "pending",
      }))
    );

    const [updated] = await db
      .update(campaignsTable)
      .set({ status: "running", startedAt: new Date(), totalCount: contacts.length })
      .where(eq(campaignsTable.id, parsed.data.id))
      .returning();

    // Simulate sending in background (demo mode)
    simulateSending(parsed.data.id, campaign.delayMin, campaign.delayMax);

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to start campaign");
    res.status(500).json({ error: "Failed to start campaign" });
  }
});

router.post("/campaigns/:id/pause", async (req, res) => {
  const parsed = PauseCampaignParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [campaign] = await db
      .update(campaignsTable)
      .set({ status: "paused" })
      .where(eq(campaignsTable.id, parsed.data.id))
      .returning();
    if (!campaign) { res.status(404).json({ error: "Not found" }); return; }
    res.json(campaign);
  } catch (err) {
    req.log.error({ err }, "Failed to pause campaign");
    res.status(500).json({ error: "Failed to pause campaign" });
  }
});

router.post("/campaigns/:id/resume", async (req, res) => {
  const parsed = ResumeCampaignParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [campaign] = await db
      .update(campaignsTable)
      .set({ status: "running" })
      .where(eq(campaignsTable.id, parsed.data.id))
      .returning();
    if (!campaign) { res.status(404).json({ error: "Not found" }); return; }
    // Resume simulation
    simulateSending(parsed.data.id, campaign.delayMin, campaign.delayMax);
    res.json(campaign);
  } catch (err) {
    req.log.error({ err }, "Failed to resume campaign");
    res.status(500).json({ error: "Failed to resume campaign" });
  }
});

router.get("/campaigns/:id/messages", async (req, res) => {
  const parsed = ListCampaignMessagesParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const messages = await db
      .select()
      .from(messageLogsTable)
      .where(eq(messageLogsTable.campaignId, parsed.data.id))
      .orderBy(messageLogsTable.createdAt);
    res.json(messages);
  } catch (err) {
    req.log.error({ err }, "Failed to list campaign messages");
    res.status(500).json({ error: "Failed to list campaign messages" });
  }
});

// Background simulation of sending messages with random delays
async function simulateSending(campaignId: number, delayMin: number, delayMax: number) {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  try {
    // Process pending messages one by one
    while (true) {
      const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));
      if (!campaign || campaign.status !== "running") break;

      const [pending] = await db
        .select()
        .from(messageLogsTable)
        .where(and(eq(messageLogsTable.campaignId, campaignId), eq(messageLogsTable.status, "pending")))
        .limit(1);

      if (!pending) {
        // No more pending — mark completed
        await db
          .update(campaignsTable)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(campaignsTable.id, campaignId));
        break;
      }

      // Simulate random success/fail (95% success rate)
      const success = Math.random() > 0.05;
      const newStatus = success ? "delivered" : "failed";

      await db
        .update(messageLogsTable)
        .set({
          status: newStatus,
          sentAt: new Date(),
          errorMessage: success ? null : "Number not on WhatsApp",
        })
        .where(eq(messageLogsTable.id, pending.id));

      // Update campaign counters
      await db
        .update(campaignsTable)
        .set({
          sentCount: sql`${campaignsTable.sentCount} + 1`,
          ...(success
            ? { deliveredCount: sql`${campaignsTable.deliveredCount} + 1` }
            : { failedCount: sql`${campaignsTable.failedCount} + 1` }),
        })
        .where(eq(campaignsTable.id, campaignId));

      // Random delay between delayMin and delayMax seconds
      const delay = (delayMin + Math.random() * (delayMax - delayMin)) * 1000;
      await sleep(delay);
    }
  } catch (err) {
    // Silently handle errors in background task
  }
}

export default router;
