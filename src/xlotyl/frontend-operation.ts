/**
 * Frontend operation orchestration: maps intent/context to UI module directives.
 * Does not execute LangGraph or domain tasks—those remain on xlotyl agent-platform.
 */

export type FrontendModuleId =
  | "topology"
  | "agent_platform_api"
  | "workflows_console"
  | "control_default";

export type ModuleDirective = {
  module: FrontendModuleId;
  action: "open" | "focus" | "hint";
  /** Suggested agent-platform HTTP surface for the UI to call (not executed here). */
  suggestedApi?: {
    method: "GET" | "POST";
    path: string;
  };
  reason: string;
};

export type PlanFrontendModulesInput = {
  /** Free-text user or operator intent. */
  intent?: string;
  /** Lowercase keyword hints from routing (optional). */
  keywords?: string[];
};

/**
 * Returns ordered UI hints. Extend heuristics as product defines module IDs in topology.json.
 */
export function planFrontendModules(input: PlanFrontendModulesInput): ModuleDirective[] {
  const raw = `${input.intent ?? ""} ${(input.keywords ?? []).join(" ")}`.toLowerCase();
  const out: ModuleDirective[] = [];

  if (raw.includes("topology") || raw.includes("graph") || raw.includes("layer")) {
    out.push({
      module: "topology",
      action: "open",
      reason: "intent_mentions_topology",
    });
  }

  if (
    raw.includes("workflow") ||
    raw.includes("wrkhrs") ||
    raw.includes("engineering") ||
    raw.includes("execute")
  ) {
    out.push({
      module: "workflows_console",
      action: "focus",
      suggestedApi: { method: "POST", path: "/v1/workflows/execute" },
      reason: "intent_mentions_workflows",
    });
  }

  if (raw.includes("health") || raw.includes("status") || raw.includes("llm")) {
    out.push({
      module: "agent_platform_api",
      action: "hint",
      suggestedApi: { method: "GET", path: "/health" },
      reason: "intent_mentions_status",
    });
  }

  if (out.length === 0) {
    out.push({
      module: "control_default",
      action: "hint",
      reason: "no_specific_module_matched",
    });
  }

  return out;
}
