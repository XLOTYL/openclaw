import { bridgePostJson } from "./bridge-http.js";
import {
  buildOpenClawBridgeEnvelope,
  type GovernedOpenClawEnvelopeInput,
} from "./openclaw-envelope.js";
import {
  bestEffortUpsertSessionMirrorEntry,
  extractSessionMirrorPatchFromQueryResponse,
} from "./session-mirror.js";

export type BirthaQueryArgs = {
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
};

function buildBirthaQueryBody(args: BirthaQueryArgs): Record<string, unknown> {
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

  const context = { ...args.context };
  context.openclaw_bridge = buildOpenClawBridgeEnvelope(args.openclawEnvelope);
  if (Object.keys(context).length > 0) {
    body.context = context;
  }

  return body;
}

export async function birthaQuery(args: BirthaQueryArgs): Promise<Record<string, unknown>> {
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
