/**
 * WhatsApp Session Manager using Baileys
 * Manages multiple WA sessions, QR codes, auth state, and real message sending.
 */
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  proto,
  WASocket,
} from "@whiskeysockets/baileys";
import { SocksProxyAgent } from "socks-proxy-agent";
// @hapi/boom is a transitive dep of baileys
type BoomLike = { output?: { statusCode?: number } };
const asBoom = (err: unknown): BoomLike => err as BoomLike;
import { db } from "@workspace/db";
import { sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as qrcode from "qrcode";
import * as path from "path";
import * as fs from "fs";
import { logger } from "../logger.js";

const AUTH_DIR = path.join(process.cwd(), ".whatsapp-auth");
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

interface SessionState {
  socket: WASocket | null;
  qr: string | null;            // base64 QR image
  status: "disconnected" | "connecting" | "connected" | "banned";
  retryCount: number;
}

const sessions = new Map<number, SessionState>();

function getAuthDir(sessionId: number) {
  const dir = path.join(AUTH_DIR, String(sessionId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function connectSession(sessionId: number): Promise<void> {
  const existing = sessions.get(sessionId);
  if (existing?.status === "connected") return;

  const state: SessionState = { socket: null, qr: null, status: "connecting", retryCount: 0 };
  sessions.set(sessionId, state);

  await db.update(sessionsTable).set({ status: "connecting", qrCode: null }).where(eq(sessionsTable.id, sessionId));

  const authDir = getAuthDir(sessionId);
  const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  // Get session info for proxy
  const [sessionInfo] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));
  const agent = sessionInfo?.proxyUrl ? new SocksProxyAgent(sessionInfo.proxyUrl) : undefined;

  const sock = makeWASocket({
    version,
    auth: {
      creds: authState.creds,
      keys: makeCacheableSignalKeyStore(authState.keys, logger as any),
    },
    agent, // Use proxy agent if configured
    printQRInTerminal: false,
    logger: logger as any,
    browser: ["WhatsBlast", "Chrome", "126.0"],
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
  });

  state.socket = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      // Generate base64 QR image
      const qrBase64 = await qrcode.toDataURL(qr);
      state.qr = qrBase64;
      state.status = "connecting";
      await db.update(sessionsTable)
        .set({ qrCode: qrBase64, status: "connecting" })
        .where(eq(sessionsTable.id, sessionId));
    }

    if (connection === "open") {
      state.status = "connected";
      state.qr = null;
      state.retryCount = 0;
      const phone = sock.user?.id?.split(":")[0] ?? null;
      await db.update(sessionsTable)
        .set({ status: "connected", qrCode: null, phone })
        .where(eq(sessionsTable.id, sessionId));
      logger.info({ sessionId, phone }, "WhatsApp session connected");
    }

    if (connection === "close") {
      const statusCode = asBoom(lastDisconnect?.error)?.output?.statusCode;
      const isBanned = statusCode === DisconnectReason.loggedOut || statusCode === 401;

      if (isBanned) {
        state.status = "banned";
        sessions.delete(sessionId);
        await db.update(sessionsTable)
          .set({ status: "banned", qrCode: null })
          .where(eq(sessionsTable.id, sessionId));
        logger.warn({ sessionId }, "WhatsApp session banned/logged out");
      } else if (state.retryCount < 3) {
        // Reconnect automatically
        state.retryCount += 1;
        state.status = "connecting";
        logger.info({ sessionId, retryCount: state.retryCount }, "Reconnecting WhatsApp session");
        setTimeout(() => connectSession(sessionId), 5000 * state.retryCount);
      } else {
        state.status = "disconnected";
        sessions.delete(sessionId);
        await db.update(sessionsTable)
          .set({ status: "disconnected" })
          .where(eq(sessionsTable.id, sessionId));
      }
    }
  });
}

export async function disconnectSession(sessionId: number): Promise<void> {
  const state = sessions.get(sessionId);
  if (state?.socket) {
    try { await state.socket.logout(); } catch {}
  }
  sessions.delete(sessionId);
  const authDir = getAuthDir(sessionId);
  if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true });
  await db.update(sessionsTable)
    .set({ status: "disconnected", qrCode: null, phone: null })
    .where(eq(sessionsTable.id, sessionId));
}

export function getSessionQr(sessionId: number): string | null {
  return sessions.get(sessionId)?.qr ?? null;
}

export function getSessionStatus(sessionId: number): string {
  return sessions.get(sessionId)?.status ?? "disconnected";
}

export function isSessionConnected(sessionId: number): boolean {
  return sessions.get(sessionId)?.status === "connected";
}

/**
 * Send a text message to a phone number via a WhatsApp session.
 * Returns true on success, false on failure.
 */
export async function sendMessage(sessionId: number, phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const state = sessions.get(sessionId);
  if (!state || state.status !== "connected" || !state.socket) {
    return { ok: false, error: "Session not connected" };
  }

  // Normalize phone to WhatsApp JID format
  const jid = normalizeJid(phone);
  if (!jid) return { ok: false, error: "Invalid phone number" };

  try {
    await state.socket.sendMessage(jid, { text: message });
    return { ok: true };
  } catch (err: any) {
    logger.error({ sessionId, phone, err: err?.message }, "Failed to send message");
    return { ok: false, error: err?.message ?? "Send failed" };
  }
}

/**
 * Normalize a phone number to a WhatsApp JID.
 * Strips non-digits, adds @s.whatsapp.net
 */
function normalizeJid(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return `${digits}@s.whatsapp.net`;
}

/**
 * Boot: reconnect all sessions that were previously connected
 */
export async function bootSessions(): Promise<void> {
  const allSessions = await db.select().from(sessionsTable);
  for (const s of allSessions) {
    // Only reconnect sessions that have auth files
    const authDir = getAuthDir(s.id);
    const credsFile = path.join(authDir, "creds.json");
    if (fs.existsSync(credsFile)) {
      logger.info({ sessionId: s.id }, "Auto-reconnecting WhatsApp session");
      connectSession(s.id).catch((err) =>
        logger.error({ sessionId: s.id, err }, "Failed to reconnect session")
      );
    } else {
      // Mark as disconnected if no auth state
      await db.update(sessionsTable).set({ status: "disconnected" }).where(eq(sessionsTable.id, s.id));
    }
  }
}
