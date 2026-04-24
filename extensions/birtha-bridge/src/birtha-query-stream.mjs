/**
 * ESM runtime (no TypeScript build). Keep in sync with birtha-query-stream.ts.
 */

import { bridgePostStream } from "./bridge-http.mjs";
import { buildOpenClawBridgeEnvelope } from "./openclaw-envelope.mjs";
import {
  bestEffortUpsertSessionMirrorEntry,
  extractSessionMirrorPatchFromStreamEvent,
} from "./session-mirror.mjs";
import { createSseJsonEventIterator } from "./sse-client.mjs";

function buildBirthaQueryStreamBody(args) {
  const context = { ...args.context };
  context.openclaw_bridge = buildOpenClawBridgeEnvelope(args.openclawEnvelope);

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
  if (Object.keys(context).length > 0) {
    body.context = context;
  }
  return body;
}

export async function* birthaQueryStream(args) {
  const response = await bridgePostStream({
    birthaApiBaseUrl: args.birthaApiBaseUrl,
    bearerToken: args.bearerToken,
    path: "/api/ai/query/stream",
    body: buildBirthaQueryStreamBody(args),
    query: {
      event_cursor: args.eventCursor,
    },
    headers: args.lastEventId ? { "Last-Event-ID": args.lastEventId } : undefined,
    label: "birtha_query_stream",
    timeoutMs: args.timeoutMs,
  });

  for await (const event of createSseJsonEventIterator(response)) {
    await bestEffortUpsertSessionMirrorEntry({
      filePath: args.sessionMirrorFilePath,
      sessionKey: args.openclawEnvelope.sessionKey,
      patch: extractSessionMirrorPatchFromStreamEvent(event),
    });
    yield event;
  }
}
