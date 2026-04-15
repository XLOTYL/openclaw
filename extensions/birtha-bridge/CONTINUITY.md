# Session mirror vs Birtha authority

## Who owns truth

- **Birtha** (`services/api-service` + orchestrator) owns governed engineering state, artifacts, and `result.referential_state`.
- **OpenClaw** persists a **shell-local mirror** only so operators/agents can resume a channel without retyping opaque ids. The mirror JSON is **not** authoritative and is never consulted by Birtha.

## What is mirrored

After each successful `birtha_query` HTTP `200` with parseable JSON, the extension merges **only string fields** present under `result.referential_state` into `birtha_state` (see `schema/session-mirror.v1.json`). Missing keys are not invented on the shell.

### Audit: top-level `result` ids (Phase 2.3)

`session-mirror-extract.ts` reads **only** `result.referential_state`. Repo audit (Birtha `execute_ai_query_pipeline` in `services/api-service/src/routes/ai.py`): promoted engineering paths populate `referential_state` in-place (`setdefault` + controlled keys); non-engineering dict results call `result_payload.setdefault("referential_state", {})`. Continuity strings the mirror cares about are **not** emitted solely as sibling keys of `result` without also living under `referential_state`. Therefore the extract path is **intentionally** limited to `referential_state` unless a future API version documents a different contract.

### Plugin hooks (`registerHook`)

The bridge plan allows optional `after_tool_call` / `before_tool_call` hooks for non-tool mirror updates. This extension **does not** register them: mirror read/write stays inside `birtha_query` / `birtha_query_stream` to avoid coupling to OpenClaw core dispatch and hook name stability.

## Resume behavior

On every `birtha_query` / `birtha_query_stream` call:

1. Load the mirror for `session_key` (hashed filename under the mirror directory).
2. For each continuity field (`engineering_session_id`, `task_id`, `run_id`, `dossier_id`, opaque `*_ref`, `selected_executor`), use **explicit tool parameters** when provided, otherwise fall back to mirrored values.
3. Build `context.openclaw_bridge` via `buildOpenclawBridgeContext` so Birtha receives the same envelope shape as a fully manual call.

`birtha_query_stream` uses the same merge for **outbound** continuity. The MVP stream does not return a full `referential_state` document in SSE events, so it does **not** replace the mirror the way `birtha_query` does after JSON success; use `birtha_query` when you need a guaranteed mirror refresh from `referential_state`.

## Clearing the cache

- **HTTP:** `DELETE /plugins/birtha-bridge/v1/session?session_key=...` (gateway auth) removes the mirror file only.
- **CLI:** `openclaw birtha session clear --session-key ...` (same effect).

Neither operation mutates Birtha. Operators clear the mirror when a shell session should forget continuity hints (for example after a mistaken `session_key` reuse).

## Storage location

`resolveMirrorDir` prefers `<plugin.rootDir>/.birtha-bridge/mirrors` when `api.rootDir` is set; otherwise `~/.openclaw/birtha-bridge/mirrors`. Writes are atomic (`*.tmp` then `rename`).
