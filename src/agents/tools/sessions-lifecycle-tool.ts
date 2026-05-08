import { Type } from "@sinclair/typebox";
import {
  describeSessionsLifecycleTool,
  SESSIONS_LIFECYCLE_TOOL_DISPLAY_SUMMARY,
} from "../tool-description-presets.js";
import { stringEnum } from "../schema/typebox.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";
import { callGatewayTool, readGatewayCallOptions } from "./gateway.js";
import { isOpenClawOwnerOnlyCoreToolName } from "./owner-only-tools.js";

const SESSIONS_LIFECYCLE_ACTIONS = [
  "delete",
  "compact",
  "compaction_list",
  "compaction_get",
  "compaction_branch",
  "compaction_restore",
] as const;

const SessionsLifecycleToolSchema = Type.Object({
  action: stringEnum(SESSIONS_LIFECYCLE_ACTIONS),
  sessionKey: Type.String(),
  checkpointId: Type.Optional(Type.String()),
  maxLines: Type.Optional(Type.Number({ minimum: 1 })),
  deleteTranscript: Type.Optional(Type.Boolean()),
  emitLifecycleHooks: Type.Optional(Type.Boolean()),
  gatewayUrl: Type.Optional(Type.String()),
  gatewayToken: Type.Optional(Type.String()),
  timeoutMs: Type.Optional(Type.Number()),
});

export function createSessionsLifecycleTool(): AnyAgentTool {
  return {
    label: "Session Lifecycle",
    name: "sessions_lifecycle",
    ownerOnly: isOpenClawOwnerOnlyCoreToolName("sessions_lifecycle"),
    displaySummary: SESSIONS_LIFECYCLE_TOOL_DISPLAY_SUMMARY,
    description: describeSessionsLifecycleTool(),
    parameters: SessionsLifecycleToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });
      const key = readStringParam(params, "sessionKey", { required: true });
      const gatewayOpts = readGatewayCallOptions(params);

      switch (action) {
        case "delete": {
          const result = await callGatewayTool("sessions.delete", gatewayOpts, {
            key,
            deleteTranscript:
              typeof params.deleteTranscript === "boolean" ? params.deleteTranscript : undefined,
            emitLifecycleHooks:
              typeof params.emitLifecycleHooks === "boolean"
                ? params.emitLifecycleHooks
                : undefined,
          });
          return jsonResult({ ok: true, result });
        }
        case "compact": {
          const result = await callGatewayTool("sessions.compact", gatewayOpts, {
            key,
            maxLines:
              typeof params.maxLines === "number" && Number.isFinite(params.maxLines)
                ? Math.max(1, Math.floor(params.maxLines))
                : undefined,
          });
          return jsonResult({ ok: true, result });
        }
        case "compaction_list": {
          const result = await callGatewayTool("sessions.compaction.list", gatewayOpts, { key });
          return jsonResult({ ok: true, result });
        }
        case "compaction_get": {
          const checkpointId = readStringParam(params, "checkpointId", { required: true });
          const result = await callGatewayTool("sessions.compaction.get", gatewayOpts, {
            key,
            checkpointId,
          });
          return jsonResult({ ok: true, result });
        }
        case "compaction_branch": {
          const checkpointId = readStringParam(params, "checkpointId", { required: true });
          const result = await callGatewayTool("sessions.compaction.branch", gatewayOpts, {
            key,
            checkpointId,
          });
          return jsonResult({ ok: true, result });
        }
        case "compaction_restore": {
          const checkpointId = readStringParam(params, "checkpointId", { required: true });
          const result = await callGatewayTool("sessions.compaction.restore", gatewayOpts, {
            key,
            checkpointId,
          });
          return jsonResult({ ok: true, result });
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  };
}
