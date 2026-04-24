import { bridgePostStream } from "./bridge-http.js";
import {
  buildOpenClawBridgeEnvelope,
  type GovernedOpenClawEnvelopeInput,
} from "./openclaw-envelope.js";
import {
  bestEffortUpsertSessionMirrorEntry,
  extractSessionMirrorPatchFromStreamEvent,
} from "./session-mirror.js";
import { createSseJsonEventIterator } from "./sse-client.js";

export type BirthaQueryStreamArgs = {
  birthaApiBaseUrl: string;
  bearerToken?: string;
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
  toolArgs?: Record<string, Record<string, unknown>>;
  context?: Record<string, unknown>;
  controlContext?: Record<string, unknown>;
  untrustedContext?: unknown;
  workspaceSnapshot?: unknown;
  userPreferences?: unknown;
  systemDirectives?: Record<string, unknown>;
  provider?: string;
  engagementMode?: string;
  openclawEnvelope: GovernedOpenClawEnvelopeInput;
  timeoutMs?: number;
  sessionMirrorFilePath?: string;
  lastEventId?: string;
  eventCursor?: string;
};

function buildBirthaQueryStreamBody(args: BirthaQueryStreamArgs): Record<string, unknown> {
  const context = { ...args.context };
  context.openclaw_bridge = buildOpenClawBridgeEnvelope(args.openclawEnvelope);

  const body: Record<string, unknown> = {};
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

export async function* birthaQueryStream(
  args: BirthaQueryStreamArgs,
): AsyncGenerator<Record<string, unknown>> {
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
