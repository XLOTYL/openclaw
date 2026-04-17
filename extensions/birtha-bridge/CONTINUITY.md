# Session mirror vs authority

The **session mirror** (plugin-local JSON keyed by `session_key`) may hold **opaque string refs** copied from `result.referential_state` returned by Birtha.

- **Authoritative** engineering artifacts, task packets, publish decisions, and referential truth live in **Xlotyl** (api-service, control plane, DevPlane).
- **Tool-model lane** responses (`POST /api/ai/tool-query`) are **never authoritative**: provenance includes `authoritative=false` and `requires_validation=true`.

Downstream runbook (server repo): [openclaw-birtha-bridge.md](https://github.com/mhold3n/server/blob/main/docs/runbooks/openclaw-birtha-bridge.md).
