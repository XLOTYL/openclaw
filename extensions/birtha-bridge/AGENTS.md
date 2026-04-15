# Birtha bridge extension

For agents: this bundled plugin is the **Phase 1** OpenClaw shell integration for Birtha. It registers a single tool that POSTs to **`/api/ai/query`** with `context.openclaw_bridge` validated by **`schemas/openclaw-bridge/v1/`** in the Birtha (server) repo.

## Boundaries

- **No OpenClaw core edits:** all logic lives here plus Birtha API validation.
- **Cache-only continuity:** optional `engineering_session_id`, `task_id`, `run_id`, and `dossier_id` must be copied from prior `result.referential_state` responses only; never invent governed ids locally.
- **ClawCode:** remains internal to Birtha’s agent-platform executor graph; this plugin never talks to ClawCode directly.

## Config

See `openclaw.plugin.json`. Prefer `birthaApiBaseUrl` in plugin config; otherwise the tool falls back to `BIRTHA_API_BASE_URL` then `http://localhost:8080`.
