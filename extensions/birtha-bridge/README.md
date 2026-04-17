# birtha-bridge (OpenClaw extension)

HTTPS client helpers for Birtha / Xlotyl api-service. **Canonical copy lives in this xlotyl repository.**

| Client | Route |
|--------|--------|
| `birthaToolQuery` | `POST /api/ai/tool-query` (tool-model lane, class **B** tools) |

Related: `birtha_query` / `birtha_query_stream` (same api-service; may live in a fuller bridge package).

## Schemas

`schemas/openclaw-bridge/v1/tool-model/` — request/response JSON Schema.

## Tool-model lane

Responses are **non-authoritative** (`lane=tool_model`). ADR in downstream server repo: [0002-openclaw-tool-model-lane.md](https://github.com/mhold3n/server/blob/main/docs/adr/0002-openclaw-tool-model-lane.md) (integration pin: `server/xlotyl/INTEGRATION.json`).

## Tests

```bash
node --test openclaw/extensions/birtha-bridge/test/birtha-tool-query.test.mjs
```
