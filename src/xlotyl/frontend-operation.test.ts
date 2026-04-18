import { describe, expect, it } from "vitest";
import { planFrontendModules } from "./frontend-operation.js";

describe("planFrontendModules", () => {
  it("returns topology when intent mentions graph", () => {
    const d = planFrontendModules({ intent: "Show the system graph layers" });
    expect(d.some((x) => x.module === "topology")).toBe(true);
  });

  it("returns workflow hint when engineering is mentioned", () => {
    const d = planFrontendModules({ intent: "Run engineering_workflow" });
    const w = d.find((x) => x.module === "workflows_console");
    expect(w?.suggestedApi?.path).toBe("/v1/workflows/execute");
  });

  it("returns default when no matches", () => {
    const d = planFrontendModules({ intent: "hello" });
    expect(d.some((x) => x.module === "control_default")).toBe(true);
  });
});
