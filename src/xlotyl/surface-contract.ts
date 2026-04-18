/**
 * Versioned UI surface for Control UI / browsers. Normalizes agent-platform /health
 * so clients do not parse multiple raw shapes. See xlotyl ADR 0004.
 */

export const XLOTY_UI_SURFACE_SCHEMA = "xlotyl.ui.surface/v1" as const;

export type XlotylUiSurfaceV1 = {
  schema: typeof XLOTY_UI_SURFACE_SCHEMA;
  generatedAt: string;
  agentPlatform: {
    reachable: boolean;
    baseUrl?: string;
    error?: string;
    health?: unknown;
  };
  modes: {
    /** From workflow input/output when available; null if unknown. */
    engagementMode: string | null;
    reasoningTier: string | null;
    /** Derived from agent-platform /health when reachable. */
    llmBackend: string | null;
    workflowReady: boolean | null;
  };
  notes?: string;
};

export type FetchHealthResult =
  | { ok: true; health: unknown }
  | { ok: false; error: string };

/**
 * Fetch agent-platform `/health` with optional auth header.
 */
export async function fetchAgentPlatformHealth(params: {
  baseUrl: string;
  token?: string;
  timeoutMs: number;
  fetchFn?: typeof fetch;
}): Promise<FetchHealthResult> {
  const { baseUrl, token, timeoutMs, fetchFn = globalThis.fetch } = params;
  const url = `${baseUrl.replace(/\/$/, "")}/health`;
  try {
    const res = await fetchFn(url, {
      method: "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const health: unknown = await res.json();
    return { ok: true, health };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function readHealthModes(health: unknown): {
  llmBackend: string | null;
  workflowReady: boolean | null;
} {
  if (!health || typeof health !== "object") {
    return { llmBackend: null, workflowReady: null };
  }
  const h = health as Record<string, unknown>;
  const llm = h.llm_backend;
  let llmBackend: string | null = null;
  if (llm && typeof llm === "object") {
    const b = (llm as Record<string, unknown>).backend;
    llmBackend = typeof b === "string" ? b : null;
  }
  const wr = h.workflow_ready;
  const workflowReady = typeof wr === "boolean" ? wr : null;
  return { llmBackend, workflowReady };
}

/**
 * Build normalized {@link XlotylUiSurfaceV1} for gateway responses.
 */
export function buildXlotylUiSurface(params: {
  baseUrl: string;
  healthResult: FetchHealthResult;
  /** Optional overrides from workflow/session context when available. */
  engagementMode?: string | null;
  reasoningTier?: string | null;
}): XlotylUiSurfaceV1 {
  const { baseUrl, healthResult, engagementMode = null, reasoningTier = null } = params;
  const reachable = healthResult.ok;
  const modesFromHealth = healthResult.ok
    ? readHealthModes(healthResult.health)
    : { llmBackend: null, workflowReady: null };

  return {
    schema: XLOTY_UI_SURFACE_SCHEMA,
    generatedAt: new Date().toISOString(),
    agentPlatform: reachable
      ? {
          reachable: true,
          baseUrl,
          health: healthResult.health,
        }
      : {
          reachable: false,
          baseUrl,
          error: healthResult.error,
        },
    modes: {
      engagementMode,
      reasoningTier,
      llmBackend: modesFromHealth.llmBackend,
      workflowReady: modesFromHealth.workflowReady,
    },
    notes:
      "engagementMode/reasoningTier are null unless supplied by caller; wire from workflow responses when product standardizes fields.",
  };
}
