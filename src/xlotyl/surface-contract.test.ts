import { describe, expect, it } from "vitest";
import { buildXlotylUiSurface, XLOTY_UI_SURFACE_SCHEMA } from "./surface-contract.js";

describe("buildXlotylUiSurface", () => {
  it("normalizes successful health", () => {
    const surface = buildXlotylUiSurface({
      baseUrl: "http://127.0.0.1:8087",
      healthResult: {
        ok: true,
        health: {
          status: "healthy",
          workflow_ready: true,
          llm_backend: { healthy: true, backend: "vllm", detail: null },
        },
      },
    });
    expect(surface.schema).toBe(XLOTY_UI_SURFACE_SCHEMA);
    expect(surface.agentPlatform.reachable).toBe(true);
    expect(surface.modes.llmBackend).toBe("vllm");
    expect(surface.modes.workflowReady).toBe(true);
    expect(surface.modes.engagementMode).toBeNull();
  });

  it("marks unreachable when fetch fails", () => {
    const surface = buildXlotylUiSurface({
      baseUrl: "http://127.0.0.1:9",
      healthResult: { ok: false, error: "ECONNREFUSED" },
    });
    expect(surface.agentPlatform.reachable).toBe(false);
    expect(surface.agentPlatform.error).toBe("ECONNREFUSED");
    expect(surface.modes.llmBackend).toBeNull();
  });
});
