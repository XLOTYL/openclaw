/**
 * Shared Birtha HTTP config and OpenClaw bridge envelope construction for
 * ``birtha_query`` / ``birtha_query_stream``.
 *
 * For agents: continuity fields are merged server-side by Birtha too; the shell
 * must still resubmit opaque refs from the session mirror when the operator
 * does not override them explicitly.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-runtime";
import { readStringParam } from "openclaw/plugin-sdk/provider-web-search";
import type { BirthaMirrorState } from "./session-mirror-types.js";

const BRIDGE_PROTO = "birtha.openclaw";
const BRIDGE_SEMVER = "1.0.0";

const REF_KEYS_IN_BRIDGE = [
  "problem_brief_ref",
  "engineering_state_ref",
  "active_task_packet_ref",
  "verification_report_ref",
  "escalation_packet_ref",
  "knowledge_pool_assessment_ref",
  "selected_executor",
] as const;

export function pluginCfg(api: OpenClawPluginApi): Record<string, unknown> {
  const raw = api.pluginConfig;
  return raw && typeof raw === "object" ? raw : {};
}

export function resolveBaseUrl(api: OpenClawPluginApi): string {
  const fromPlugin = readStringParam(pluginCfg(api), "birthaApiBaseUrl");
  if (fromPlugin) {
    return fromPlugin.replace(/\/$/, "");
  }
  const env =
    typeof process.env.BIRTHA_API_BASE_URL === "string"
      ? process.env.BIRTHA_API_BASE_URL.trim()
      : "";
  if (env) {
    return env.replace(/\/$/, "");
  }
  return "http://localhost:8080";
}

export function resolveBearer(api: OpenClawPluginApi): string | undefined {
  const t = readStringParam(pluginCfg(api), "birthaApiBearerToken");
  if (t) {
    return t;
  }
  const env = process.env.BIRTHA_API_BEARER_TOKEN;
  return typeof env === "string" && env.trim() ? env.trim() : undefined;
}

export function buildOpenclawBridgeContext(params: {
  sessionKey: string;
  channel: string;
  sender: string;
  idempotencyKey: string;
  attachments: unknown[];
  merged: BirthaMirrorState;
  streaming?: boolean;
}): { openclaw_bridge: Record<string, unknown>; context: Record<string, unknown> } {
  const openclaw_bridge: Record<string, unknown> = {
    bridge: { proto: BRIDGE_PROTO, version: BRIDGE_SEMVER },
    session_key: params.sessionKey,
    channel: params.channel,
    sender: params.sender,
    idempotency_key: params.idempotencyKey,
    attachments: params.attachments,
    client_capabilities: {
      max_inline_attachment_bytes: 65536,
      ...(params.streaming ? { streaming_requested: true } : {}),
    },
  };
  if (params.merged.engineering_session_id) {
    openclaw_bridge.engineering_session_id = params.merged.engineering_session_id;
  }
  if (params.merged.task_id) {
    openclaw_bridge.task_id = params.merged.task_id;
  }
  if (params.merged.run_id) {
    openclaw_bridge.run_id = params.merged.run_id;
  }
  if (params.merged.dossier_id) {
    openclaw_bridge.dossier_id = params.merged.dossier_id;
  }
  for (const k of REF_KEYS_IN_BRIDGE) {
    const v = params.merged[k];
    if (typeof v === "string" && v.length > 0) {
      openclaw_bridge[k] = v;
    }
  }
  const context: Record<string, unknown> = { openclaw_bridge };
  if (params.merged.engineering_session_id) {
    context.engineering_session_id = params.merged.engineering_session_id;
  }
  return { openclaw_bridge, context };
}
