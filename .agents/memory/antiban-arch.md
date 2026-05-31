---
name: Anti-ban Architecture
description: How the WhatsBlast anti-ban system is structured
---

**Rule:** All anti-ban logic lives server-side in `artifacts/api-server/src/whatsapp/antiban.ts`. Never duplicate on the client.

**Why:** Client can be inspected/bypassed. Rate limits, blacklist checks, and session health must be enforced server-side.

**How to apply:** Campaign sending loop in campaigns.ts calls antiban functions in order:
1. `resetDailyCountIfNeeded` — resets counter + advances warm-up day at midnight
2. `canSessionSend` — checks time window + daily limit + session status
3. `isBlacklisted` — skips blacklisted numbers
4. `applyVariation` — adds invisible unicode char to message text
5. `humanTypingDelay` — waits proportional to message length
6. `sendMessage` (manager.ts) — real Baileys send or simulation fallback
7. `recordSessionFailure` / `resetSessionFailures` — tracks consecutive failures; 5+ → marks session banned
8. Batch pause after `campaign.batchSize` messages using `campaign.batchPauseSeconds`
