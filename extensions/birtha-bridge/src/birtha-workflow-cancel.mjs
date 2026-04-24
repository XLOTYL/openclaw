/**
 * ESM runtime (no TypeScript build). Keep in sync with birtha-workflow-cancel.ts.
 */

import { bridgePostJson } from "./bridge-http.mjs";

export async function birthaWorkflowCancel(args) {
  return bridgePostJson({
    birthaApiBaseUrl: args.birthaApiBaseUrl,
    bearerToken: args.bearerToken,
    path: `/api/ai/workflows/${encodeURIComponent(args.workflowId)}/cancel`,
    body: {},
    label: "birtha_workflow_cancel",
    timeoutMs: args.timeoutMs,
  });
}
