---
name: Baileys Runtime Dependencies
description: Baileys requires explicit installation of protobufjs and libsignal in api-server
---

**Rule:** When adding @whiskeysockets/baileys to api-server, always explicitly install `protobufjs` and `libsignal` as direct dependencies.

**Why:** These are listed as `external` in `build.mjs` (so esbuild doesn't bundle them), meaning Node.js must resolve them at runtime from node_modules. But they're only transitive deps of Baileys and pnpm's strict hoisting won't make them available to the api-server package unless explicitly added.

**How to apply:** After `pnpm add @whiskeysockets/baileys`, immediately run `pnpm add protobufjs libsignal` in artifacts/api-server.
