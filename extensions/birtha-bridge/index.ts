/**
 * Birtha bridge: HTTPS clients for Xlotyl api-service and OpenClaw tool registration.
 */
import { definePluginEntry, type AnyAgentTool } from "openclaw/plugin-sdk/plugin-entry";
import { createBirthaToolModelTool } from "./src/birtha-tool-model-tool.js";
import { registerXlotylSurfaceRoute } from "./src/xlotyl-surface.js";
export { birthaQuery, type BirthaQueryArgs } from "./src/birtha-query.js";
export { birthaQueryStream, type BirthaQueryStreamArgs } from "./src/birtha-query-stream.js";
export {
  birthaToolQuery,
  type BirthaToolQueryArgs,
  type ToolQueryResult,
} from "./src/birtha-tool-query.js";
export {
  birthaWorkflowStatus,
  type BirthaWorkflowStatusArgs,
} from "./src/birtha-workflow-status.js";
export {
  birthaWorkflowCancel,
  type BirthaWorkflowCancelArgs,
} from "./src/birtha-workflow-cancel.js";
export {
  birthaRunningGet,
  birthaRunningEventsGet,
  type BirthaRunningGetArgs,
  type BirthaRunningEventsGetArgs,
} from "./src/birtha-running.js";
export {
  assertGovernedOpenClawEnvelopeInput,
  assertOpenClawBridgeEnvelope,
  buildOpenClawBridgeEnvelope,
  type GovernedOpenClawClientCapabilities,
  type GovernedOpenClawEnvelopeInput,
  type OpenClawBridgeAttachment,
  type OpenClawBridgeEnvelope,
} from "./src/openclaw-envelope.js";
export {
  bestEffortUpsertSessionMirrorEntry,
  extractSessionMirrorPatchFromQueryResponse,
  extractSessionMirrorPatchFromWorkflowStatusResponse,
  extractSessionMirrorPatchFromStreamEvent,
  loadSessionMirror,
  mergeSessionMirrorEntry,
  saveSessionMirror,
  upsertSessionMirrorEntry,
  type SessionMirrorEntry,
  type SessionMirrorRefs,
  type SessionMirrorState,
} from "./src/session-mirror.js";
export {
  buildXlotylSurfaceDocument,
  readXlotylBridgeConfig,
  registerXlotylSurfaceRoute,
  shouldRegisterXlotylSurface,
} from "./src/xlotyl-surface.js";

export default definePluginEntry({
  id: "birtha-bridge",
  name: "Birtha Bridge",
  description: "HTTPS clients for Birtha / Xlotyl api-service and xlotyl surface bridge",
  register(api) {
    api.registerTool(createBirthaToolModelTool(api) as AnyAgentTool);
    registerXlotylSurfaceRoute(api);
  },
});
