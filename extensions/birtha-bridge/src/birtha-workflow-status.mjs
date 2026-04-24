/**
 * ESM runtime (no TypeScript build). Keep in sync with birtha-workflow-status.ts.
 */

import { bridgeGetJson } from "./bridge-http.mjs";
import {
  bestEffortUpsertSessionMirrorEntry,
  extractSessionMirrorPatchFromWorkflowStatusResponse,
} from "./session-mirror.mjs";

export async function birthaWorkflowStatus(args) {
  const response = await bridgeGetJson({
    birthaApiBaseUrl: args.birthaApiBaseUrl,
    bearerToken: args.bearerToken,
    path: `/api/ai/workflows/${encodeURIComponent(args.workflowId)}/status`,
    label: "birtha_workflow_status",
    timeoutMs: args.timeoutMs,
  });
  await bestEffortUpsertSessionMirrorEntry({
    filePath: args.sessionMirrorFilePath,
    sessionKey: args.sessionKey,
    patch: extractSessionMirrorPatchFromWorkflowStatusResponse(response),
  });
  return response;
}
