import { bridgeGetJson } from "./bridge-http.js";
import {
  bestEffortUpsertSessionMirrorEntry,
  extractSessionMirrorPatchFromWorkflowStatusResponse,
} from "./session-mirror.js";

export type BirthaWorkflowStatusArgs = {
  birthaApiBaseUrl: string;
  workflowId: string;
  bearerToken?: string;
  timeoutMs?: number;
  sessionKey?: string;
  sessionMirrorFilePath?: string;
};

export async function birthaWorkflowStatus(
  args: BirthaWorkflowStatusArgs,
): Promise<Record<string, unknown>> {
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
