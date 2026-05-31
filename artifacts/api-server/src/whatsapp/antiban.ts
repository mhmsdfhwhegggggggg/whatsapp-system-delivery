/**
 * Anti-Ban Engine
 * All logic to protect WhatsApp accounts from being banned during bulk sending.
 *
 * Strategies implemented:
 * 1. Warm-up schedule — new accounts start slow, limits auto-increase daily
 * 2. Time window — only send during configured hours (e.g. 9am–9pm)
 * 3. Randomized human-like delays — between every message
 * 4. Batch pauses — longer rest after every N messages
 * 5. Message variation — subtle changes so each message is unique
 * 6. Daily limit enforcement — hard stop per session
 * 7. Auto-stop on ban detection — if consecutive failures spike, halt
 * 8. Blacklist check — skip numbers that must never be contacted
 */

import { db } from "@workspace/db";
import { sessionsTable, blacklistTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../logger.js";

// ── Warm-up schedule ─────────────────────────────────────────────────────────
// Day 1 = 30 msgs, Day 2 = 60, Day 3 = 100, Day 4 = 150, Day 5+ = full limit
const WARMUP_SCHEDULE = [30, 60, 100, 150, 200, 250, 300];

export function getWarmupLimit(warmupDay: number, configuredLimit: number): number {
  if (warmupDay <= 0 || warmupDay > WARMUP_SCHEDULE.length) return configuredLimit;
  return Math.min(WARMUP_SCHEDULE[warmupDay - 1], configuredLimit);
}

// ── Daily limit reset ─────────────────────────────────────────────────────────
export async function resetDailyCountIfNeeded(sessionId: number): Promise<void> {
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));
  if (!session) return;

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  if (session.lastResetDate === today) return;

  // New day — reset counter, advance warm-up day
  const newWarmupDay = session.warmupMode
    ? Math.min((session.warmupDay ?? 1) + 1, WARMUP_SCHEDULE.length + 1)
    : session.warmupDay ?? 1;

  await db.update(sessionsTable).set({
    dailySentCount: 0,
    lastResetDate: today,
    warmupDay: newWarmupDay,
  }).where(eq(sessionsTable.id, sessionId));

  logger.info({ sessionId, newWarmupDay }, "Daily limit reset, warm-up day advanced");
}

// ── Check if session can send ─────────────────────────────────────────────────
export async function canSessionSend(sessionId: number): Promise<{ ok: boolean; reason?: string }> {
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));
  if (!session) return { ok: false, reason: "Session not found" };
  if (session.status === "banned") return { ok: false, reason: "Session is banned" };
  if (session.status !== "connected") return { ok: false, reason: "Session not connected" };

  // Time window check
  const hour = new Date().getHours();
  const start = session.sendHourStart ?? 9;
  const end = session.sendHourEnd ?? 21;
  if (hour < start || hour >= end) {
    return { ok: false, reason: `Outside send window (${start}:00–${end}:00)` };
  }

  // Daily limit check
  const effectiveLimit = session.warmupMode
    ? getWarmupLimit(session.warmupDay ?? 1, session.dailyLimit)
    : session.dailyLimit;

  if ((session.dailySentCount ?? 0) >= effectiveLimit) {
    return { ok: false, reason: `Daily limit reached (${session.dailySentCount}/${effectiveLimit})` };
  }

  return { ok: true };
}

// ── Blacklist check ───────────────────────────────────────────────────────────
export async function isBlacklisted(phone: string): Promise<boolean> {
  const digits = phone.replace(/\D/g, "");
  const result = await db
    .select({ id: blacklistTable.id })
    .from(blacklistTable)
    .where(eq(blacklistTable.phone, digits))
    .limit(1);
  return result.length > 0;
}

export async function addToBlacklist(phone: string, reason?: string): Promise<void> {
  const digits = phone.replace(/\D/g, "");
  await db.insert(blacklistTable).values({ phone: digits, reason: reason ?? null }).onConflictDoNothing();
}

// ── Increment session sent count ──────────────────────────────────────────────
export async function incrementSessionSentCount(sessionId: number): Promise<void> {
  await db.update(sessionsTable)
    .set({ dailySentCount: sql`${sessionsTable.dailySentCount} + 1` })
    .where(eq(sessionsTable.id, sessionId));
}

// ── Handle consecutive failures ───────────────────────────────────────────────
export async function recordSessionFailure(sessionId: number): Promise<{ shouldStop: boolean }> {
  await db.update(sessionsTable)
    .set({ consecutiveFailures: sql`${sessionsTable.consecutiveFailures} + 1` })
    .where(eq(sessionsTable.id, sessionId));

  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));
  const failures = session?.consecutiveFailures ?? 0;

  // 5 consecutive failures → likely banned/blocked, stop
  if (failures >= 5) {
    logger.warn({ sessionId, failures }, "Too many consecutive failures — marking session as banned");
    await db.update(sessionsTable).set({ status: "banned" }).where(eq(sessionsTable.id, sessionId));
    return { shouldStop: true };
  }
  return { shouldStop: false };
}

export async function resetSessionFailures(sessionId: number): Promise<void> {
  await db.update(sessionsTable)
    .set({ consecutiveFailures: 0 })
    .where(eq(sessionsTable.id, sessionId));
}

// ── Message variation ─────────────────────────────────────────────────────────
// Adds subtle invisible Unicode chars and slight punctuation variation
// so each message is technically unique (avoids spam-filter exact matches)
const ZWS = "\u200B";   // Zero-width space
const ZWNJ = "\u200C";  // Zero-width non-joiner
const ZWJ = "\u200D";   // Zero-width joiner
const INVISIBLE_CHARS = [ZWS, ZWNJ, ZWJ];

export function applyVariation(text: string, seed: number): string {
  // Insert one invisible char at a pseudorandom position
  const insertAt = (seed * 7 + 3) % Math.max(1, text.length - 1);
  const char = INVISIBLE_CHARS[seed % INVISIBLE_CHARS.length];
  return text.slice(0, insertAt) + char + text.slice(insertAt);
}

// ── Template variable substitution ───────────────────────────────────────────
export function substituteVariables(
  template: string,
  variables: Record<string, string>,
  contactName?: string | null,
  phone?: string
): string {
  let result = template;
  // Auto-fill common variables
  const allVars: Record<string, string> = {
    name: contactName ?? "",
    phone: phone ?? "",
    date: new Date().toLocaleDateString("ar-SA"),
    time: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
    ...variables,
  };
  for (const [key, val] of Object.entries(allVars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
  }
  return result;
}

// ── Human-like delay ──────────────────────────────────────────────────────────
// Adds extra delay proportional to message length (simulates typing reading)
export function humanTypingDelay(messageLength: number): number {
  // ~50-100ms per character, max extra 3 seconds
  return Math.min(messageLength * (50 + Math.random() * 50), 3000);
}

// ── Random delay between messages ────────────────────────────────────────────
export function randomDelay(minSeconds: number, maxSeconds: number): number {
  return (minSeconds + Math.random() * (maxSeconds - minSeconds)) * 1000;
}

// ── Sleep helper ──────────────────────────────────────────────────────────────
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Wait until send window opens ─────────────────────────────────────────────
export async function waitForSendWindow(sessionId: number): Promise<void> {
  while (true) {
    const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));
    if (!session) return;

    const hour = new Date().getHours();
    const start = session.sendHourStart ?? 9;
    const end = session.sendHourEnd ?? 21;

    if (hour >= start && hour < end) return; // Window is open

    // Calculate ms until window opens
    const now = new Date();
    const openTime = new Date(now);
    openTime.setHours(start, 0, 0, 0);
    if (openTime <= now) openTime.setDate(openTime.getDate() + 1); // Tomorrow
    const waitMs = openTime.getTime() - now.getTime();

    logger.info({ sessionId, waitMs, start, end }, "Outside send window — waiting");
    await sleep(Math.min(waitMs, 60_000)); // Check again every minute max
  }
}
