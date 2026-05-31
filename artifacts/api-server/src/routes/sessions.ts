import { Router } from "express";
import { db } from "@workspace/db";
import { sessionsTable, blacklistTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateSessionBody,
  GetSessionParams,
  DeleteSessionParams,
  GetSessionQrParams,
} from "@workspace/api-zod";
import {
  connectSession,
  disconnectSession,
  getSessionQr,
} from "../whatsapp/manager.js";

const router = Router();

router.get("/sessions", async (req, res) => {
  try {
    const sessions = await db.select().from(sessionsTable).orderBy(sessionsTable.createdAt);
    res.json(sessions);
  } catch (err) {
    req.log.error({ err }, "Failed to list sessions");
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

router.post("/sessions", async (req, res) => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [session] = await db.insert(sessionsTable).values({
      name: parsed.data.name,
      dailyLimit: parsed.data.dailyLimit ?? 50,
      warmupMode: true,
      warmupDay: 1,
      status: "connecting",
    }).returning();

    // Start WhatsApp connection in background
    connectSession(session.id).catch((err) =>
      req.log.error({ err, sessionId: session.id }, "Failed to connect session")
    );

    res.status(201).json(session);
  } catch (err) {
    req.log.error({ err }, "Failed to create session");
    res.status(500).json({ error: "Failed to create session" });
  }
});

router.get("/sessions/:id", async (req, res) => {
  const parsed = GetSessionParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, parsed.data.id));
    if (!session) { res.status(404).json({ error: "Not found" }); return; }
    res.json(session);
  } catch (err) {
    req.log.error({ err }, "Failed to get session");
    res.status(500).json({ error: "Failed to get session" });
  }
});

router.delete("/sessions/:id", async (req, res) => {
  const parsed = DeleteSessionParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await disconnectSession(parsed.data.id);
    await db.delete(sessionsTable).where(eq(sessionsTable.id, parsed.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete session");
    res.status(500).json({ error: "Failed to delete session" });
  }
});

router.get("/sessions/:id/qr", async (req, res) => {
  const parsed = GetSessionQrParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, parsed.data.id));
    if (!session) { res.status(404).json({ error: "Not found" }); return; }

    // Prefer live QR from manager, fall back to DB
    const liveQr = getSessionQr(parsed.data.id);
    res.json({ qr: liveQr ?? session.qrCode ?? null, status: session.status });
  } catch (err) {
    req.log.error({ err }, "Failed to get QR");
    res.status(500).json({ error: "Failed to get QR" });
  }
});

// ── Blacklist ────────────────────────────────────────────────────────────────
router.get("/blacklist", async (req, res) => {
  try {
    const list = await db.select().from(blacklistTable).orderBy(blacklistTable.createdAt);
    res.json(list);
  } catch (err) {
    req.log.error({ err }, "Failed to list blacklist");
    res.status(500).json({ error: "Failed to list blacklist" });
  }
});

router.post("/blacklist", async (req, res) => {
  const { phone, reason } = req.body as { phone?: string; reason?: string };
  if (!phone) { res.status(400).json({ error: "phone required" }); return; }
  try {
    const [entry] = await db.insert(blacklistTable)
      .values({ phone: phone.replace(/\D/g, ""), reason: reason ?? null })
      .onConflictDoNothing()
      .returning();
    res.status(201).json(entry ?? { phone, reason });
  } catch (err) {
    req.log.error({ err }, "Failed to add to blacklist");
    res.status(500).json({ error: "Failed to add to blacklist" });
  }
});

router.delete("/blacklist/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.delete(blacklistTable).where(eq(blacklistTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete blacklist entry");
    res.status(500).json({ error: "Failed to delete from blacklist" });
  }
});

export default router;
