import { bridgePostJson } from "./bridge-http.js";

export type BirthaWorkflowCancelArgs = {
  birthaApiBaseUrl: string;
  workflowId: string;
  bearerToken?: string;
  timeoutMs?: number;
};

export async function birthaWorkflowCancel(
  args: BirthaWorkflowCancelArgs,
): Promise<Record<string, unknown>> {
  return bridgePostJson({
    birthaApiBaseUrl: args.birthaApiBaseUrl,
    bearerToken: args.bearerToken,
    path: `/api/ai/workflows/${encodeURIComponent(args.workflowId)}/cancel`,
    body: {},
    label: "birtha_workflow_cancel",
    timeoutMs: args.timeoutMs,
  });
}
