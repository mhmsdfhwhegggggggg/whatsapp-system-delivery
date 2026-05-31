import { Router } from "express";
import { db } from "@workspace/db";
import { sessionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  CreateSessionBody,
  GetSessionParams,
  DeleteSessionParams,
  GetSessionQrParams,
} from "@workspace/api-zod";

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
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const [session] = await db
      .insert(sessionsTable)
      .values({
        name: parsed.data.name,
        dailyLimit: parsed.data.dailyLimit ?? 50,
        status: "disconnected",
      })
      .returning();
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
    res.json({ qr: session.qrCode ?? null, status: session.status });
  } catch (err) {
    req.log.error({ err }, "Failed to get QR");
    res.status(500).json({ error: "Failed to get QR" });
  }
});

export default router;
