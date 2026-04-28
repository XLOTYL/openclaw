# birtha-bridge (OpenClaw extension)

HTTPS client helpers for Birtha / Xlotyl api-service. **Canonical copy lives in this xlotyl repository.**

| Client                   | Route                                                          |
| ------------------------ | -------------------------------------------------------------- |
| `birthaToolQuery`        | `POST /api/ai/tool-query` (tool-model lane, class **B** tools) |
| `birthaQuery`            | `POST /api/ai/query` (governed lane)                           |
| `birthaQueryStream`      | `POST /api/ai/query/stream` (governed SSE lane)                |
| `birthaWorkflowStatus`   | `GET /api/ai/workflows/{workflow_id}/status`                   |
| `birthaWorkflowCancel`   | `POST /api/ai/workflows/{workflow_id}/cancel`                  |
| `birthaRunningGet`       | `GET /api/running`                                             |
| `birthaRunningEventsGet` | `GET /api/running/events`                                      |

The plugin also registers a read-only OpenClaw route when `xlotyl.enabled=true` and
`xlotyl.agentPlatformBaseUrl` is configured:

| Route                | Purpose                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| `/xlotyl/v1/surface` | Normalized connectivity + governed surface summary for shell/UI consumers. |

## Schemas

- `schemas/openclaw-bridge/v1/tool-model/` — tool-model lane request/response JSON Schema.
- `schemas/openclaw-bridge/v1/governed-openclaw-envelope-input.schema.json` — adapter-owned camelCase helper input for governed bridge calls.
- `schemas/openclaw-bridge/v1/openclaw-bridge-envelope.schema.json` — wire envelope carried in `context.openclaw_bridge`.

## Tool-model lane

Responses are **non-authoritative** (`lane=tool_model`). ADR: [docs/adr/0002-openclaw-tool-model-lane.md](../../../docs/adr/0002-openclaw-tool-model-lane.md). Optional downstream mirror: `server/docs/adr/0002-openclaw-tool-model-lane.md` (integration pin: `xlotyl/INTEGRATION.json`).

## Governed lane + session mirror

`birthaQuery` and `birthaQueryStream` now require a typed `openclawEnvelope` input. The adapter
owns envelope construction, injects `bridge.proto` / `bridge.version`, derives `session_key`, and
validates the final wire envelope before any HTTP request.

`birthaQuery`, `birthaQueryStream`, and workflow status polling may optionally update a plugin-local
**session mirror** keyed by `session_key`. Mirror writes are serialized with a lock file, persisted
with same-directory temp-file rename, and treated as best-effort cache updates so governed requests
still return their primary network result if the mirror cannot be written. The mirror stores only
XLOTYL refs returned by governed flows:

- `workflow_id`
- `engineering_session_id`
- `run_id`
- `problem_brief_ref`
- `engineering_state_ref`
- `active_task_packet_ref`
- `verification_report_ref`

The mirror is non-authoritative. Canonical state remains in XLOTYL.

For **governed OpenClaw sessions**, the OpenClaw-side continuity truth is the session entry's
`xlotyl` block, not the plugin-local mirror. `sessions.send` / `sessions.steer` branch on
`authority=xlotyl_governed`, route through `birthaQueryStream`, and project inbound XLOTYL lifecycle
back into native OpenClaw `sessions.changed` / `session.message` semantics. The mirror remains a
helper cache for standalone bridge helper usage outside the governed session adapter path.

Canonical XLOTYL session projection surfaces:

- `GET /api/openclaw/sessions/stream` — SSE projection of `sessions.changed` / `session.message`
- `GET /api/openclaw/sessions/events` — finite cursor polling for the same envelopes

Workflow status polling refreshes the same mirror from `GET /api/ai/workflows/{workflow_id}/status`
using the status payload’s `id` / `workflow_id` and `result.referential_state`.

## Tests

```bash
node --test openclaw/extensions/birtha-bridge/test/birtha-tool-query.test.mjs
node --test openclaw/extensions/birtha-bridge/test/birtha-governed-bridge.test.mjs
node --test openclaw/extensions/birtha-bridge/test/xlotyl-surface.test.mjs
```
