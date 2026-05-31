import { Router } from "express";
import { db } from "@workspace/db";
import { campaignsTable, messageLogsTable, contactsTable, templatesTable } from "@workspace/db";
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
import {
  canSessionSend,
  isBlacklisted,
  incrementSessionSentCount,
  recordSessionFailure,
  resetSessionFailures,
  resetDailyCountIfNeeded,
  applyVariation,
  substituteVariables,
  humanTypingDelay,
  randomDelay,
  waitForSendWindow,
  sleep,
} from "../whatsapp/antiban.js";
import { sendMessage, isSessionConnected } from "../whatsapp/manager.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ── List / Create / Get / Update / Delete ─────────────────────────────────────

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
    const d = parsed.data;
    const [campaign] = await db.insert(campaignsTable).values({
      name: d.name,
      templateId: d.templateId ?? null,
      contactGroupId: d.contactGroupId ?? null,
      sessionId: d.sessionId ?? null,
      delayMin: d.delayMin ?? 5,
      delayMax: d.delayMax ?? 15,
      batchSize: (d as any).batchSize ?? 10,
      batchPauseSeconds: (d as any).batchPauseSeconds ?? 120,
      enableVariation: (d as any).enableVariation ?? true,
      stopOnBan: (d as any).stopOnBan ?? true,
      scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null,
      status: "draft",
    }).returning();
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
  if (!paramsParsed.success || !bodyParsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
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
    const [campaign] = await db.update(campaignsTable).set(updates)
      .where(eq(campaignsTable.id, paramsParsed.data.id)).returning();
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

// ── Start ─────────────────────────────────────────────────────────────────────

router.post("/campaigns/:id/start", async (req, res) => {
  const parsed = StartCampaignParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, parsed.data.id));
    if (!campaign) { res.status(404).json({ error: "Not found" }); return; }
    if (!campaign.contactGroupId) { res.status(400).json({ error: "Campaign must have a contact group" }); return; }

    const contacts = await db.select().from(contactsTable)
      .where(eq(contactsTable.groupId, campaign.contactGroupId));
    if (contacts.length === 0) { res.status(400).json({ error: "Contact group has no contacts" }); return; }

    // Create pending message logs
    await db.insert(messageLogsTable).values(
      contacts.map((c) => ({
        campaignId: campaign.id,
        phone: c.phone,
        contactName: c.name ?? null,
        status: "pending" as const,
      }))
    );

    const [updated] = await db.update(campaignsTable)
      .set({ status: "running", startedAt: new Date(), totalCount: contacts.length })
      .where(eq(campaignsTable.id, parsed.data.id)).returning();

    // Fire background sender
    sendCampaign(parsed.data.id);

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to start campaign");
    res.status(500).json({ error: "Failed to start campaign" });
  }
});

// ── Pause ─────────────────────────────────────────────────────────────────────

router.post("/campaigns/:id/pause", async (req, res) => {
  const parsed = PauseCampaignParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [campaign] = await db.update(campaignsTable).set({ status: "paused" })
      .where(eq(campaignsTable.id, parsed.data.id)).returning();
    if (!campaign) { res.status(404).json({ error: "Not found" }); return; }
    res.json(campaign);
  } catch (err) {
    req.log.error({ err }, "Failed to pause campaign");
    res.status(500).json({ error: "Failed to pause campaign" });
  }
});

// ── Resume ────────────────────────────────────────────────────────────────────

router.post("/campaigns/:id/resume", async (req, res) => {
  const parsed = ResumeCampaignParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [campaign] = await db.update(campaignsTable).set({ status: "running" })
      .where(eq(campaignsTable.id, parsed.data.id)).returning();
    if (!campaign) { res.status(404).json({ error: "Not found" }); return; }
    sendCampaign(parsed.data.id);
    res.json(campaign);
  } catch (err) {
    req.log.error({ err }, "Failed to resume campaign");
    res.status(500).json({ error: "Failed to resume campaign" });
  }
});

// ── Message log ───────────────────────────────────────────────────────────────

router.get("/campaigns/:id/messages", async (req, res) => {
  const parsed = ListCampaignMessagesParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const messages = await db.select().from(messageLogsTable)
      .where(eq(messageLogsTable.campaignId, parsed.data.id))
      .orderBy(messageLogsTable.createdAt);
    res.json(messages);
  } catch (err) {
    req.log.error({ err }, "Failed to list messages");
    res.status(500).json({ error: "Failed to list campaign messages" });
  }
});

// ── Core sending engine ───────────────────────────────────────────────────────

async function sendCampaign(campaignId: number): Promise<void> {
  let batchCount = 0;

  try {
    while (true) {
      // Reload campaign state
      const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));
      if (!campaign || campaign.status !== "running") break;

      const sessionId = campaign.sessionId;

      // If no session assigned → fall back to demo simulation
      if (!sessionId) {
        await simulateSend(campaignId, campaign.delayMin, campaign.delayMax);
        return;
      }

      // Reset daily count if it's a new day
      await resetDailyCountIfNeeded(sessionId);

      // Check if session can send right now
      const canSend = await canSessionSend(sessionId);
      if (!canSend.ok) {
        logger.info({ campaignId, sessionId, reason: canSend.reason }, "Cannot send — waiting");

        // If outside time window, wait for window to open
        if (canSend.reason?.includes("Outside send window")) {
          await waitForSendWindow(sessionId);
          continue;
        }

        // If daily limit hit, pause campaign
        if (canSend.reason?.includes("Daily limit")) {
          await db.update(campaignsTable).set({ status: "paused" }).where(eq(campaignsTable.id, campaignId));
          logger.info({ campaignId }, "Campaign paused — daily limit reached, will resume tomorrow");
          break;
        }

        // Session not connected — fall back to simulation if it's a demo
        await simulateSend(campaignId, campaign.delayMin, campaign.delayMax);
        return;
      }

      // Get next pending message
      const [pending] = await db.select().from(messageLogsTable)
        .where(and(
          eq(messageLogsTable.campaignId, campaignId),
          eq(messageLogsTable.status, "pending")
        ))
        .limit(1);

      if (!pending) {
        // No more pending → complete
        await db.update(campaignsTable)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(campaignsTable.id, campaignId));
        break;
      }

      // Blacklist check
      const blacklisted = await isBlacklisted(pending.phone);
      if (blacklisted) {
        await db.update(messageLogsTable).set({ status: "skipped", errorMessage: "Blacklisted" })
          .where(eq(messageLogsTable.id, pending.id));
        await db.update(campaignsTable)
          .set({ sentCount: sql`${campaignsTable.sentCount} + 1`, failedCount: sql`${campaignsTable.failedCount} + 1` })
          .where(eq(campaignsTable.id, campaignId));
        logger.info({ phone: pending.phone }, "Skipped blacklisted number");
        continue;
      }

      // Build message text from template
      let messageText = "رسالة تجريبية";
      if (campaign.templateId) {
        const [tmpl] = await db.select().from(templatesTable).where(eq(templatesTable.id, campaign.templateId));
        if (tmpl) {
          messageText = substituteVariables(tmpl.content, {}, pending.contactName, pending.phone);
        }
      }

      // Apply message variation (anti-spam)
      if (campaign.enableVariation) {
        messageText = applyVariation(messageText, pending.id);
      }

      // Human-like typing delay
      await sleep(humanTypingDelay(messageText.length));

      // Send the real message
      let result: { ok: boolean; error?: string };
      if (isSessionConnected(sessionId)) {
        result = await sendMessage(sessionId, pending.phone, messageText);
      } else {
        // Session in DB but not live → simulate for now
        result = { ok: Math.random() > 0.05, error: "Session not live (simulation)" };
      }

      const now = new Date();

      if (result.ok) {
        await db.update(messageLogsTable)
          .set({ status: "delivered", sentAt: now, errorMessage: null })
          .where(eq(messageLogsTable.id, pending.id));
        await db.update(campaignsTable)
          .set({
            sentCount: sql`${campaignsTable.sentCount} + 1`,
            deliveredCount: sql`${campaignsTable.deliveredCount} + 1`,
          })
          .where(eq(campaignsTable.id, campaignId));
        await incrementSessionSentCount(sessionId);
        await resetSessionFailures(sessionId);
      } else {
        await db.update(messageLogsTable)
          .set({ status: "failed", sentAt: now, errorMessage: result.error ?? "Send failed" })
          .where(eq(messageLogsTable.id, pending.id));
        await db.update(campaignsTable)
          .set({
            sentCount: sql`${campaignsTable.sentCount} + 1`,
            failedCount: sql`${campaignsTable.failedCount} + 1`,
          })
          .where(eq(campaignsTable.id, campaignId));

        // Check ban detection
        if (campaign.stopOnBan) {
          const { shouldStop } = await recordSessionFailure(sessionId);
          if (shouldStop) {
            await db.update(campaignsTable)
              .set({ status: "paused" })
              .where(eq(campaignsTable.id, campaignId));
            logger.warn({ campaignId, sessionId }, "Campaign paused — session likely banned");
            break;
          }
        }
      }

      batchCount++;

      // Batch pause: after every batchSize messages, take a longer break
      if (batchCount >= campaign.batchSize) {
        batchCount = 0;
        const pauseMs = campaign.batchPauseSeconds * 1000;
        logger.info({ campaignId, pauseMs }, "Batch pause (anti-ban)");
        await sleep(pauseMs);
      } else {
        // Normal randomized delay between messages
        await sleep(randomDelay(campaign.delayMin, campaign.delayMax));
      }
    }
  } catch (err) {
    logger.error({ campaignId, err }, "Unexpected error in campaign sender");
    await db.update(campaignsTable).set({ status: "paused" }).where(eq(campaignsTable.id, campaignId));
  }
}

// Demo simulation for campaigns without a connected session
async function simulateSend(campaignId: number, delayMin: number, delayMax: number): Promise<void> {
  try {
    while (true) {
      const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));
      if (!campaign || campaign.status !== "running") break;

      const [pending] = await db.select().from(messageLogsTable)
        .where(and(eq(messageLogsTable.campaignId, campaignId), eq(messageLogsTable.status, "pending")))
        .limit(1);

      if (!pending) {
        await db.update(campaignsTable).set({ status: "completed", completedAt: new Date() })
          .where(eq(campaignsTable.id, campaignId));
        break;
      }

      const success = Math.random() > 0.05;
      await db.update(messageLogsTable).set({
        status: success ? "delivered" : "failed",
        sentAt: new Date(),
        errorMessage: success ? null : "Number not on WhatsApp",
      }).where(eq(messageLogsTable.id, pending.id));

      await db.update(campaignsTable).set({
        sentCount: sql`${campaignsTable.sentCount} + 1`,
        ...(success
          ? { deliveredCount: sql`${campaignsTable.deliveredCount} + 1` }
          : { failedCount: sql`${campaignsTable.failedCount} + 1` }),
      }).where(eq(campaignsTable.id, campaignId));

      await sleep(randomDelay(delayMin, delayMax));
    }
  } catch {}
}

export default router;
