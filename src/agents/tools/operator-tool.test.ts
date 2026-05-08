import { beforeEach, describe, expect, it, vi } from "vitest";

const gatewayMocks = vi.hoisted(() => ({
  callGatewayTool: vi.fn(),
  readGatewayCallOptions: vi.fn(() => ({})),
}));

vi.mock("./gateway.js", () => ({
  callGatewayTool: gatewayMocks.callGatewayTool,
  readGatewayCallOptions: gatewayMocks.readGatewayCallOptions,
}));

import { createOperatorTool } from "./operator-tool.js";

describe("createOperatorTool", () => {
  beforeEach(() => {
    gatewayMocks.callGatewayTool.mockReset();
    gatewayMocks.readGatewayCallOptions.mockReset();
    gatewayMocks.readGatewayCallOptions.mockReturnValue({});
  });

  it("is owner-only", () => {
    const tool = createOperatorTool();
    expect(tool.ownerOnly).toBe(true);
  });

  it("rejects unknown actions", async () => {
    const tool = createOperatorTool();
    await expect(
      tool.execute("call-1", {
        action: "unknown",
      }),
    ).rejects.toThrow(/Unknown action/i);
  });

  it("routes logs_tail to gateway logs.tail", async () => {
    gatewayMocks.callGatewayTool.mockResolvedValue({ lines: [] });
    const tool = createOperatorTool();

    await tool.execute("call-2", {
      action: "logs_tail",
      limit: 20,
      cursor: 0,
      maxBytes: 8000,
    });

    expect(gatewayMocks.callGatewayTool).toHaveBeenCalledWith("logs.tail", {}, {
      cursor: 0,
      limit: 20,
      maxBytes: 8000,
    });
  });

  it("routes sessions compaction get action", async () => {
    gatewayMocks.callGatewayTool.mockResolvedValue({ ok: true });
    const tool = createOperatorTool();

    await tool.execute("call-3", {
      action: "sessions_compaction_get",
      sessionKey: "main",
      checkpointId: "chk-1",
    });

    expect(gatewayMocks.callGatewayTool).toHaveBeenCalledWith("sessions.compaction.get", {}, {
      key: "main",
      checkpointId: "chk-1",
    });
  });

  it("routes sessions_patch to gateway sessions.patch", async () => {
    gatewayMocks.callGatewayTool.mockResolvedValue({ ok: true });
    const tool = createOperatorTool();

    await tool.execute("call-patch", {
      action: "sessions_patch",
      sessionKey: "main",
      model: "gpt-5",
    });

    expect(gatewayMocks.callGatewayTool).toHaveBeenCalledWith("sessions.patch", {}, {
      key: "main",
      model: "gpt-5",
    });
  });

  it("routes sessions_reset to gateway sessions.reset", async () => {
    gatewayMocks.callGatewayTool.mockResolvedValue({ ok: true });
    const tool = createOperatorTool();

    await tool.execute("call-reset", {
      action: "sessions_reset",
      sessionKey: "main",
      reason: "reset",
    });

    expect(gatewayMocks.callGatewayTool).toHaveBeenCalledWith("sessions.reset", {}, {
      key: "main",
      reason: "reset",
    });
  });

  it("routes sessions_steer to gateway sessions.steer", async () => {
    gatewayMocks.callGatewayTool.mockResolvedValue({ ok: true });
    const tool = createOperatorTool();

    await tool.execute("call-steer", {
      action: "sessions_steer",
      sessionKey: "main",
      message: "Stop and summarize",
      timeoutMs: 5000,
    });

    expect(gatewayMocks.callGatewayTool).toHaveBeenCalledWith("sessions.steer", {}, {
      key: "main",
      message: "Stop and summarize",
      thinking: undefined,
      attachments: undefined,
      timeoutMs: 5000,
      idempotencyKey: undefined,
    });
  });

  it("routes chat_abort with runId to gateway chat.abort", async () => {
    gatewayMocks.callGatewayTool.mockResolvedValue({ ok: true });
    const tool = createOperatorTool();

    await tool.execute("call-abort", {
      action: "chat_abort",
      sessionKey: "main",
      runId: "run-1",
    });

    expect(gatewayMocks.callGatewayTool).toHaveBeenCalledWith("chat.abort", {}, {
      sessionKey: "main",
      runId: "run-1",
    });
  });

  it("routes chat_abort without runId for session-scoped abort", async () => {
    gatewayMocks.callGatewayTool.mockResolvedValue({ ok: true });
    const tool = createOperatorTool();

    await tool.execute("call-abort2", {
      action: "chat_abort",
      sessionKey: "main",
    });

    expect(gatewayMocks.callGatewayTool).toHaveBeenCalledWith("chat.abort", {}, {
      sessionKey: "main",
      runId: undefined,
    });
  });

  it("routes agents_file_list to gateway agents.files.list", async () => {
    gatewayMocks.callGatewayTool.mockResolvedValue({ files: [] });
    const tool = createOperatorTool();

    await tool.execute("call-files-list", {
      action: "agents_file_list",
      agentId: "agent-1",
    });

    expect(gatewayMocks.callGatewayTool).toHaveBeenCalledWith("agents.files.list", {}, {
      agentId: "agent-1",
    });
  });

  it("routes agents_file_get to gateway agents.files.get", async () => {
    gatewayMocks.callGatewayTool.mockResolvedValue({ ok: true });
    const tool = createOperatorTool();

    await tool.execute("call-files-get", {
      action: "agents_file_get",
      agentId: "agent-1",
      name: "SOUL.md",
    });

    expect(gatewayMocks.callGatewayTool).toHaveBeenCalledWith("agents.files.get", {}, {
      agentId: "agent-1",
      name: "SOUL.md",
    });
  });

  it("routes agents_file_set to gateway agents.files.set", async () => {
    gatewayMocks.callGatewayTool.mockResolvedValue({ ok: true });
    const tool = createOperatorTool();

    await tool.execute("call-files-set", {
      action: "agents_file_set",
      agentId: "agent-1",
      name: "SOUL.md",
      content: "hello",
    });

    expect(gatewayMocks.callGatewayTool).toHaveBeenCalledWith("agents.files.set", {}, {
      agentId: "agent-1",
      name: "SOUL.md",
      content: "hello",
    });
  });

  it("routes agents_list to gateway agents.list", async () => {
    gatewayMocks.callGatewayTool.mockResolvedValue({ agents: [] });
    const tool = createOperatorTool();

    await tool.execute("call-agents-list", { action: "agents_list" });

    expect(gatewayMocks.callGatewayTool).toHaveBeenCalledWith("agents.list", {}, {});
  });

  it("routes agents_create to gateway agents.create", async () => {
    gatewayMocks.callGatewayTool.mockResolvedValue({ ok: true });
    const tool = createOperatorTool();

    await tool.execute("call-agents-create", {
      action: "agents_create",
      name: "Beta",
      workspace: "/tmp/ws",
      model: "gpt-5",
    });

    expect(gatewayMocks.callGatewayTool).toHaveBeenCalledWith("agents.create", {}, {
      name: "Beta",
      workspace: "/tmp/ws",
      model: "gpt-5",
    });
  });

  it("routes agents_update to gateway agents.update", async () => {
    gatewayMocks.callGatewayTool.mockResolvedValue({ ok: true });
    const tool = createOperatorTool();

    await tool.execute("call-agents-update", {
      action: "agents_update",
      agentId: "beta",
      name: "Beta2",
    });

    expect(gatewayMocks.callGatewayTool).toHaveBeenCalledWith("agents.update", {}, {
      agentId: "beta",
      name: "Beta2",
    });
  });

  it("routes agents_delete to gateway agents.delete", async () => {
    gatewayMocks.callGatewayTool.mockResolvedValue({ ok: true });
    const tool = createOperatorTool();

    await tool.execute("call-agents-delete", {
      action: "agents_delete",
      agentId: "beta",
      deleteFiles: true,
    });

    expect(gatewayMocks.callGatewayTool).toHaveBeenCalledWith("agents.delete", {}, {
      agentId: "beta",
      deleteFiles: true,
    });
  });
});
