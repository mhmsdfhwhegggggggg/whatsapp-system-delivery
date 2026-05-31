# WhatsBlast

نظام الإرسال الجماعي عبر واتساب — A professional Arabic bulk WhatsApp messaging platform with campaign management, contact lists, message templates, anti-ban features, and analytics.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served at `/api`)
- `pnpm --filter @workspace/whatsapp-blast run dev` — run the React frontend (served at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Wouter (RTL, Arabic)
- API: Express 5 (at `/api`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Charts: Recharts

## Where things live

- `lib/db/src/schema/` — DB schema (sessions, contact_groups, contacts, templates, campaigns, message_logs)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas
- `artifacts/api-server/src/routes/` — API route handlers
- `artifacts/whatsapp-blast/src/pages/` — frontend pages (dashboard, campaigns, campaign-detail, contacts, templates, sessions, analytics)
- `artifacts/whatsapp-blast/src/components/Layout.tsx` — RTL sidebar layout

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed React Query hooks + Zod schemas; never write fetch calls manually
- RTL layout with Arabic UI throughout; green SaaS color palette (primary: `155 45% 38%`)
- Campaign sending is simulated (background async loop, 95% success rate, random delays) — replace with real WhatsApp client
- Anti-ban: randomized delay between messages (configurable min/max seconds), daily send limit per session
- Sessions page shows QR code endpoint for future WhatsApp Web integration

## Product

- **Dashboard** — overview stats (total campaigns, active, messages sent, delivery rate, contacts)
- **Campaigns** — create/start/pause/resume campaigns with template + contact list + session selection
- **Campaign Detail** — real-time progress bar, message-by-message log with status
- **Contacts** — contact groups, add individual contacts, bulk CSV import
- **Templates** — message templates with `{{variable}}` dynamic placeholders, media support
- **Sessions** — WhatsApp account management, daily limits, QR code linking, anti-ban info
- **Analytics** — bar chart + pie chart + campaign stats table

## User preferences

_Populate as needed._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after editing `openapi.yaml`
- Paths are NOT rewritten by the proxy; the API server handles `/api/...` itself
- Do not run `pnpm dev` at workspace root — use individual workflow restarts

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
