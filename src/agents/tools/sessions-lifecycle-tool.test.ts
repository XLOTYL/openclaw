import { beforeEach, describe, expect, it, vi } from "vitest";

const gatewayMocks = vi.hoisted(() => ({
  callGatewayTool: vi.fn(),
  readGatewayCallOptions: vi.fn(() => ({})),
}));

vi.mock("./gateway.js", () => ({
  callGatewayTool: gatewayMocks.callGatewayTool,
  readGatewayCallOptions: gatewayMocks.readGatewayCallOptions,
}));

import { createSessionsLifecycleTool } from "./sessions-lifecycle-tool.js";

describe("createSessionsLifecycleTool", () => {
  beforeEach(() => {
    gatewayMocks.callGatewayTool.mockReset();
    gatewayMocks.readGatewayCallOptions.mockReset();
    gatewayMocks.readGatewayCallOptions.mockReturnValue({});
  });

  it("is owner-only", () => {
    const tool = createSessionsLifecycleTool();
    expect(tool.ownerOnly).toBe(true);
  });

  it("routes delete action to sessions.delete", async () => {
    gatewayMocks.callGatewayTool.mockResolvedValue({ ok: true });
    const tool = createSessionsLifecycleTool();

    await tool.execute("call-1", {
      action: "delete",
      sessionKey: "main",
      deleteTranscript: true,
      emitLifecycleHooks: false,
    });

    expect(gatewayMocks.callGatewayTool).toHaveBeenCalledWith("sessions.delete", {}, {
      key: "main",
      deleteTranscript: true,
      emitLifecycleHooks: false,
    });
  });

  it("requires checkpointId for checkpoint actions", async () => {
    gatewayMocks.callGatewayTool.mockResolvedValue({ ok: true });
    const tool = createSessionsLifecycleTool();

    await expect(
      tool.execute("call-2", {
        action: "compaction_get",
        sessionKey: "main",
      }),
    ).rejects.toThrow(/checkpointId/i);
  });
});
