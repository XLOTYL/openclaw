import { Type } from "@sinclair/typebox";
import {
  describeOperatorTool,
  OPERATOR_TOOL_DISPLAY_SUMMARY,
} from "../tool-description-presets.js";
import { stringEnum } from "../schema/typebox.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";
import { callGatewayTool, readGatewayCallOptions } from "./gateway.js";
import { isOpenClawOwnerOnlyCoreToolName } from "./owner-only-tools.js";

const OPERATOR_ACTIONS = [
  "usage_status",
  "usage_cost",
  "sessions_usage",
  "sessions_usage_timeseries",
  "sessions_usage_logs",
  "logs_tail",
  "sessions_patch",
  "sessions_reset",
  "sessions_steer",
  "chat_abort",
  "agents_file_list",
  "agents_file_get",
  "agents_file_set",
  "agents_file_delete",
  "agents_list",
  "agents_create",
  "agents_update",
  "agents_delete",
  "skills_status",
  "skills_search",
  "skills_detail",
  "skills_install",
  "skills_update",
  "exec_approvals_get",
  "exec_approvals_set",
  "exec_approvals_node_get",
  "exec_approvals_node_set",
  "exec_approval_list",
  "exec_approval_get",
  "exec_approval_request",
  "exec_approval_wait_decision",
  "exec_approval_resolve",
  "plugin_approval_list",
  "plugin_approval_request",
  "plugin_approval_wait_decision",
  "plugin_approval_resolve",
  "sessions_compact",
  "sessions_compaction_list",
  "sessions_compaction_get",
  "sessions_compaction_branch",
  "sessions_compaction_restore",
] as const;

const OperatorToolSchema = Type.Object(
  {
    action: stringEnum(OPERATOR_ACTIONS),
    gatewayUrl: Type.Optional(Type.String()),
    gatewayToken: Type.Optional(Type.String()),
    timeoutMs: Type.Optional(Type.Number()),
    sessionKey: Type.Optional(Type.String()),
    checkpointId: Type.Optional(Type.String()),
    startDate: Type.Optional(Type.String()),
    endDate: Type.Optional(Type.String()),
    mode: Type.Optional(
      Type.Union([Type.Literal("utc"), Type.Literal("gateway"), Type.Literal("specific")]),
    ),
    utcOffset: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Number({ minimum: 1 })),
    includeContextWeight: Type.Optional(Type.Boolean()),
    cursor: Type.Optional(Type.Number({ minimum: 0 })),
    maxBytes: Type.Optional(Type.Number({ minimum: 1 })),
    query: Type.Optional(Type.String()),
    slug: Type.Optional(Type.String()),
    name: Type.Optional(Type.String()),
    skillKey: Type.Optional(Type.String()),
    enabled: Type.Optional(Type.Boolean()),
    apiKey: Type.Optional(Type.String()),
    id: Type.Optional(Type.String()),
    decision: Type.Optional(Type.String()),
    requestId: Type.Optional(Type.String()),
    nodeId: Type.Optional(Type.String()),
    file: Type.Optional(Type.Unknown()),
    baseHash: Type.Optional(Type.String()),
    pluginId: Type.Optional(Type.String()),
    title: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    severity: Type.Optional(Type.String()),
    toolName: Type.Optional(Type.String()),
    toolCallId: Type.Optional(Type.String()),
    agentId: Type.Optional(Type.String()),
    workspace: Type.Optional(Type.String()),
    deleteFiles: Type.Optional(Type.Boolean()),
    turnSourceChannel: Type.Optional(Type.String()),
    turnSourceTo: Type.Optional(Type.String()),
    turnSourceAccountId: Type.Optional(Type.String()),
    turnSourceThreadId: Type.Optional(Type.Union([Type.String(), Type.Number()])),
    twoPhase: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: true },
);

function parsePositiveInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(1, Math.floor(value));
}

function parseNonNegativeInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.floor(value));
}

/** Field names accepted by `sessions.patch` (besides `key`, supplied as `sessionKey`). */
const SESSIONS_PATCH_OPTIONAL_KEYS = [
  "label",
  "thinkingLevel",
  "fastMode",
  "verboseLevel",
  "traceLevel",
  "reasoningLevel",
  "responseUsage",
  "elevatedLevel",
  "execHost",
  "execSecurity",
  "execAsk",
  "execNode",
  "model",
  "spawnedBy",
  "spawnedWorkspaceDir",
  "spawnDepth",
  "subagentRole",
  "subagentControlScope",
  "sendPolicy",
  "groupActivation",
] as const;

function buildSessionsPatchPayload(params: Record<string, unknown>): Record<string, unknown> {
  const key = readStringParam(params, "sessionKey", { required: true });
  const out: Record<string, unknown> = { key };
  for (const field of SESSIONS_PATCH_OPTIONAL_KEYS) {
    if (Object.prototype.hasOwnProperty.call(params, field)) {
      out[field] = params[field];
    }
  }
  return out;
}

export function createOperatorTool(): AnyAgentTool {
  return {
    label: "Operator",
    name: "operator",
    ownerOnly: isOpenClawOwnerOnlyCoreToolName("operator"),
    displaySummary: OPERATOR_TOOL_DISPLAY_SUMMARY,
    description: describeOperatorTool(),
    parameters: OperatorToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });
      const gatewayOpts = readGatewayCallOptions(params);

      switch (action) {
        case "usage_status":
          return jsonResult({ ok: true, result: await callGatewayTool("usage.status", gatewayOpts, {}) });
        case "usage_cost":
          return jsonResult({ ok: true, result: await callGatewayTool("usage.cost", gatewayOpts, {}) });
        case "sessions_usage": {
          const result = await callGatewayTool("sessions.usage", gatewayOpts, {
            key: readStringParam(params, "sessionKey") ?? undefined,
            startDate: readStringParam(params, "startDate") ?? undefined,
            endDate: readStringParam(params, "endDate") ?? undefined,
            mode: readStringParam(params, "mode") ?? undefined,
            utcOffset: readStringParam(params, "utcOffset") ?? undefined,
            limit: parsePositiveInteger(params.limit),
            includeContextWeight:
              typeof params.includeContextWeight === "boolean" ? params.includeContextWeight : undefined,
          });
          return jsonResult({ ok: true, result });
        }
        case "sessions_usage_timeseries":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("sessions.usage.timeseries", gatewayOpts, {}),
          });
        case "sessions_usage_logs":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("sessions.usage.logs", gatewayOpts, {}),
          });
        case "logs_tail": {
          const result = await callGatewayTool("logs.tail", gatewayOpts, {
            cursor:
              typeof params.cursor === "number" && Number.isFinite(params.cursor)
                ? Math.max(0, Math.floor(params.cursor))
                : undefined,
            limit: parsePositiveInteger(params.limit),
            maxBytes: parsePositiveInteger(params.maxBytes),
          });
          return jsonResult({ ok: true, result });
        }
        case "sessions_patch": {
          const result = await callGatewayTool("sessions.patch", gatewayOpts, buildSessionsPatchPayload(params));
          return jsonResult({ ok: true, result });
        }
        case "sessions_reset": {
          const reasonRaw = readStringParam(params, "reason");
          const reason = reasonRaw === "new" || reasonRaw === "reset" ? reasonRaw : undefined;
          const result = await callGatewayTool("sessions.reset", gatewayOpts, {
            key: readStringParam(params, "sessionKey", { required: true }),
            ...(reason ? { reason } : {}),
          });
          return jsonResult({ ok: true, result });
        }
        case "sessions_steer": {
          const result = await callGatewayTool("sessions.steer", gatewayOpts, {
            key: readStringParam(params, "sessionKey", { required: true }),
            message: readStringParam(params, "message", { required: true }),
            thinking: readStringParam(params, "thinking") ?? undefined,
            attachments: Array.isArray(params.attachments) ? params.attachments : undefined,
            timeoutMs: parseNonNegativeInteger(params.timeoutMs),
            idempotencyKey: readStringParam(params, "idempotencyKey") ?? undefined,
          });
          return jsonResult({ ok: true, result });
        }
        case "chat_abort": {
          const result = await callGatewayTool("chat.abort", gatewayOpts, {
            sessionKey: readStringParam(params, "sessionKey", { required: true }),
            runId: readStringParam(params, "runId") ?? undefined,
          });
          return jsonResult({ ok: true, result });
        }
        case "agents_file_list":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("agents.files.list", gatewayOpts, {
              agentId: readStringParam(params, "agentId", { required: true }),
            }),
          });
        case "agents_file_get":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("agents.files.get", gatewayOpts, {
              agentId: readStringParam(params, "agentId", { required: true }),
              name: readStringParam(params, "name", { required: true }),
            }),
          });
        case "agents_file_set":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("agents.files.set", gatewayOpts, {
              agentId: readStringParam(params, "agentId", { required: true }),
              name: readStringParam(params, "name", { required: true }),
              content: readStringParam(params, "content", {
                required: true,
                allowEmpty: true,
                trim: false,
              }),
            }),
          });
        case "agents_file_delete":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("agents.files.delete", gatewayOpts, {
              agentId: readStringParam(params, "agentId", { required: true }),
              name: readStringParam(params, "name", { required: true }),
            }),
          });
        case "agents_list":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("agents.list", gatewayOpts, {}),
          });
        case "agents_create": {
          const createPayload: Record<string, unknown> = {
            name: readStringParam(params, "name", { required: true }),
            workspace: readStringParam(params, "workspace", { required: true }),
          };
          const createModel = readStringParam(params, "model");
          if (createModel !== undefined) {
            createPayload.model = createModel;
          }
          const createEmoji = readStringParam(params, "emoji", { allowEmpty: true });
          if (createEmoji !== undefined) {
            createPayload.emoji = createEmoji;
          }
          const createAvatar = readStringParam(params, "avatar", { allowEmpty: true });
          if (createAvatar !== undefined) {
            createPayload.avatar = createAvatar;
          }
          return jsonResult({
            ok: true,
            result: await callGatewayTool("agents.create", gatewayOpts, createPayload),
          });
        }
        case "agents_update": {
          const agentId = readStringParam(params, "agentId", { required: true });
          const patch: Record<string, unknown> = { agentId };
          const name = readStringParam(params, "name");
          if (name !== undefined) {
            patch.name = name;
          }
          const workspace = readStringParam(params, "workspace");
          if (workspace !== undefined) {
            patch.workspace = workspace;
          }
          const model = readStringParam(params, "model");
          if (model !== undefined) {
            patch.model = model;
          }
          const emoji = readStringParam(params, "emoji", { allowEmpty: true });
          if (emoji !== undefined) {
            patch.emoji = emoji;
          }
          const avatar = readStringParam(params, "avatar", { allowEmpty: true });
          if (avatar !== undefined) {
            patch.avatar = avatar;
          }
          return jsonResult({
            ok: true,
            result: await callGatewayTool("agents.update", gatewayOpts, patch),
          });
        }
        case "agents_delete":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("agents.delete", gatewayOpts, {
              agentId: readStringParam(params, "agentId", { required: true }),
              ...(typeof params.deleteFiles === "boolean" ? { deleteFiles: params.deleteFiles } : {}),
            }),
          });
        case "skills_status":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("skills.status", gatewayOpts, {
              agentId: readStringParam(params, "agentId") ?? undefined,
            }),
          });
        case "skills_search":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("skills.search", gatewayOpts, {
              query: readStringParam(params, "query") ?? undefined,
              limit: parsePositiveInteger(params.limit),
            }),
          });
        case "skills_detail":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("skills.detail", gatewayOpts, {
              slug: readStringParam(params, "slug", { required: true }),
            }),
          });
        case "skills_install":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("skills.install", gatewayOpts, params),
          });
        case "skills_update":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("skills.update", gatewayOpts, params),
          });
        case "exec_approvals_get":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("exec.approvals.get", gatewayOpts, {}),
          });
        case "exec_approvals_set":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("exec.approvals.set", gatewayOpts, {
              file: params.file,
              baseHash: readStringParam(params, "baseHash") ?? undefined,
            }),
          });
        case "exec_approvals_node_get":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("exec.approvals.node.get", gatewayOpts, {
              nodeId: readStringParam(params, "nodeId", { required: true }),
            }),
          });
        case "exec_approvals_node_set":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("exec.approvals.node.set", gatewayOpts, {
              nodeId: readStringParam(params, "nodeId", { required: true }),
              file: params.file,
              baseHash: readStringParam(params, "baseHash") ?? undefined,
            }),
          });
        case "exec_approval_list":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("exec.approval.list", gatewayOpts, {}),
          });
        case "exec_approval_get":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("exec.approval.get", gatewayOpts, {
              id: readStringParam(params, "id", { required: true }),
            }),
          });
        case "exec_approval_request":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("exec.approval.request", gatewayOpts, params),
          });
        case "exec_approval_wait_decision":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("exec.approval.waitDecision", gatewayOpts, {
              id: readStringParam(params, "id", { required: true }),
            }),
          });
        case "exec_approval_resolve":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("exec.approval.resolve", gatewayOpts, {
              id: readStringParam(params, "id", { required: true }),
              decision: readStringParam(params, "decision", { required: true }),
            }),
          });
        case "plugin_approval_list":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("plugin.approval.list", gatewayOpts, {}),
          });
        case "plugin_approval_request":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("plugin.approval.request", gatewayOpts, params),
          });
        case "plugin_approval_wait_decision":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("plugin.approval.waitDecision", gatewayOpts, {
              id: readStringParam(params, "id", { required: true }),
            }),
          });
        case "plugin_approval_resolve":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("plugin.approval.resolve", gatewayOpts, {
              id: readStringParam(params, "id", { required: true }),
              decision: readStringParam(params, "decision", { required: true }),
            }),
          });
        case "sessions_compact":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("sessions.compact", gatewayOpts, {
              key: readStringParam(params, "sessionKey", { required: true }),
            }),
          });
        case "sessions_compaction_list":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("sessions.compaction.list", gatewayOpts, {
              key: readStringParam(params, "sessionKey", { required: true }),
            }),
          });
        case "sessions_compaction_get":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("sessions.compaction.get", gatewayOpts, {
              key: readStringParam(params, "sessionKey", { required: true }),
              checkpointId: readStringParam(params, "checkpointId", { required: true }),
            }),
          });
        case "sessions_compaction_branch":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("sessions.compaction.branch", gatewayOpts, {
              key: readStringParam(params, "sessionKey", { required: true }),
              checkpointId: readStringParam(params, "checkpointId", { required: true }),
            }),
          });
        case "sessions_compaction_restore":
          return jsonResult({
            ok: true,
            result: await callGatewayTool("sessions.compaction.restore", gatewayOpts, {
              key: readStringParam(params, "sessionKey", { required: true }),
              checkpointId: readStringParam(params, "checkpointId", { required: true }),
            }),
          });
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  };
}
