/**
 * ESM runtime (no TypeScript build). Keep in sync with birtha-query.ts.
 */

import { bridgePostJson } from "./bridge-http.mjs";
import { buildOpenClawBridgeEnvelope } from "./openclaw-envelope.mjs";
import {
  bestEffortUpsertSessionMirrorEntry,
  extractSessionMirrorPatchFromQueryResponse,
} from "./session-mirror.mjs";

function buildBirthaQueryBody(args) {
  const body = {};
  if (args.prompt !== undefined) {
    body.prompt = args.prompt;
  }
  if (args.messages !== undefined) {
    body.messages = args.messages;
  }
  if (args.model !== undefined) {
    body.model = args.model;
  }
  if (args.temperature !== undefined) {
    body.temperature = args.temperature;
  }
  if (args.maxTokens !== undefined) {
    body.max_tokens = args.maxTokens;
  }
  if (args.tools !== undefined) {
    body.tools = args.tools;
  }
  if (args.toolArgs !== undefined) {
    body.tool_args = args.toolArgs;
  }
  if (args.controlContext !== undefined) {
    body.control_context = args.controlContext;
  }
  if (args.untrustedContext !== undefined) {
    body.untrusted_context = args.untrustedContext;
  }
  if (args.workspaceSnapshot !== undefined) {
    body.workspace_snapshot = args.workspaceSnapshot;
  }
  if (args.userPreferences !== undefined) {
    body.user_preferences = args.userPreferences;
  }
  if (args.systemDirectives !== undefined) {
    body.system_directives = args.systemDirectives;
  }
  if (args.provider !== undefined) {
    body.provider = args.provider;
  }
  if (args.engagementMode !== undefined) {
    body.engagement_mode = args.engagementMode;
  }

  const context = { ...args.context };
  context.openclaw_bridge = buildOpenClawBridgeEnvelope(args.openclawEnvelope);
  if (Object.keys(context).length > 0) {
    body.context = context;
  }

  return body;
}

export async function birthaQuery(args) {
  const response = await bridgePostJson({
    birthaApiBaseUrl: args.birthaApiBaseUrl,
    bearerToken: args.bearerToken,
    path: "/api/ai/query",
    body: buildBirthaQueryBody(args),
    label: "birtha_query",
    timeoutMs: args.timeoutMs,
  });
  await bestEffortUpsertSessionMirrorEntry({
    filePath: args.sessionMirrorFilePath,
    sessionKey: args.openclawEnvelope.sessionKey,
    patch: extractSessionMirrorPatchFromQueryResponse(response),
  });
  return response;
}
