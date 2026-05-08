# Gateway agent tool parity

The file [`gateway-agent-tool-parity.json`](gateway-agent-tool-parity.json) is the source of truth for **which gateway RPC method names** appear in OpenClaw agent TypeScript.

## Surfaces (string literals)

The `surfaces.*` arrays list methods invoked as `callGatewayTool("…")` or `callGateway("…")` in grouped modules (operator, gateway, nodes, cron, plus extended areas such as `sessions_lifecycle`, `bash_exec`, `pi_plugin_hooks`, `canvas`). CI compares each surface to a filesystem scan in [`src/agents/tools/gateway-agent-tool-parity.test.ts`](../../src/agents/tools/gateway-agent-tool-parity.test.ts).

## Dynamic `callGateway({ method })`

Some modules pass the RPC name via `callGateway({ method: "…", … })`. Those calls are **not** visible to the string-literal regex. The JSON field `dynamic_gateway_methods` is an explicit allowlist; `dynamic_gateway_method_sources` lists the files scanned for `method: "…"` patterns (gateway-shaped names only). When you add a new dynamic call site, extend both lists and run the parity test.

## Tests

From a checkout with dev dependencies installed at the OpenClaw repo root, run the parity test (path may match your package layout):

`vitest run src/agents/tools/gateway-agent-tool-parity.test.ts`
