# Birtha bridge (OpenClaw extension)

Phase 1–3 integration:

- **`birtha_query`** — `POST /api/ai/query` with **`context.openclaw_bridge`** (`schemas/openclaw-bridge/v1/` in this repo).
- **`birtha_query_stream`** — `POST /api/ai/query/stream` (typed SSE MVP; see `src/sse-client.ts`).
- **Session mirror** — automatic load/merge/save from `result.referential_state` on successful JSON responses (`CONTINUITY.md`, `schema/session-mirror.v1.json`).
- **Operator surface** — gateway `GET`/`DELETE` under `/plugins/birtha-bridge/v1/session` and CLI `openclaw birtha session …`.

## Configuration

In OpenClaw plugin config for `birtha-bridge`:

- **`birthaApiBaseUrl`** — Birtha `api-service` root (example: `http://localhost:8080`).
- **`birthaApiBearerToken`** — Optional `Authorization: Bearer` token.

Environment fallbacks: `BIRTHA_API_BASE_URL`, `BIRTHA_API_BEARER_TOKEN`.

## Session continuity

See **`CONTINUITY.md`** for mirror vs Birtha authority, resume, and clearing the cache. In short: explicit tool args win; otherwise the mirror supplies opaque string refs copied from the last successful `birtha_query` response.

## Idempotency

Each tool call sends an **`idempotency_key`** (caller-supplied or a fresh UUID per call). Retries with the same key and identical payload receive the cached JSON body from Birtha (`200`); conflicting payloads yield **`409`**. The **stream** route does not apply Redis idempotency replay — use `birtha_query` when you need replay semantics.

## Streaming consumer (Phase 3.4)

`birtha_query_stream` collects SSE events into the tool result JSON. **`registerGatewayMethod`** push-to-operator-UI is **deferred** — there is no control-plane subscriber in-tree; use gateway logs or wrap the tool caller if you need live fan-out.

## Further reading

- Mirror semantics: `CONTINUITY.md`
- Birtha schemas: `schemas/openclaw-bridge/v1/README.md`
- SSE vocabulary: `schemas/openclaw-bridge/v1/events/README.md`
- Runbook: `docs/runbooks/openclaw-birtha-bridge.md`
- OpenClaw plugins: [Building plugins](https://docs.openclaw.ai/plugins/building-plugins)
