import { beforeEach, describe, expect, it, vi } from "vitest";
import { execApprovalsHandlers } from "./exec-approvals.js";
import type { GatewayRequestHandlerOptions } from "./types.js";

const {
  ensureExecApprovalsMock,
  mergeExecApprovalsSocketDefaultsMock,
  normalizeExecApprovalsMock,
  readExecApprovalsSnapshotMock,
  saveExecApprovalsMock,
} = vi.hoisted(() => ({
  ensureExecApprovalsMock: vi.fn(),
  mergeExecApprovalsSocketDefaultsMock: vi.fn(),
  normalizeExecApprovalsMock: vi.fn(),
  readExecApprovalsSnapshotMock: vi.fn(),
  saveExecApprovalsMock: vi.fn(),
}));

vi.mock("../../infra/exec-approvals.js", () => ({
  ensureExecApprovals: ensureExecApprovalsMock,
  mergeExecApprovalsSocketDefaults: mergeExecApprovalsSocketDefaultsMock,
  normalizeExecApprovals: normalizeExecApprovalsMock,
  readExecApprovalsSnapshot: readExecApprovalsSnapshotMock,
  saveExecApprovals: saveExecApprovalsMock,
}));

const approvalsFile = {
  version: 1,
  defaults: { ask: "never" },
};

function createOptions(
  method: string,
  params: Record<string, unknown>,
  overrides?: Partial<GatewayRequestHandlerOptions>,
): GatewayRequestHandlerOptions {
  return {
    req: { type: "req", id: "req-1", method, params },
    params,
    client: null,
    isWebchatConnect: () => false,
    respond: vi.fn(),
    context: {
      broadcast: vi.fn(),
      logGateway: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
      nodeRegistry: {
        invoke: vi.fn(),
      },
    },
    ...overrides,
  } as unknown as GatewayRequestHandlerOptions;
}

describe("execApprovalsHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    normalizeExecApprovalsMock.mockImplementation((file) => file);
    mergeExecApprovalsSocketDefaultsMock.mockImplementation(({ normalized }) => normalized);
  });

  it("broadcasts exec.approvals.changed after saving gateway approvals", async () => {
    readExecApprovalsSnapshotMock
      .mockReturnValueOnce({
        path: "/tmp/exec-approvals.json",
        exists: true,
        hash: "hash-before",
        file: approvalsFile,
      })
      .mockReturnValueOnce({
        path: "/tmp/exec-approvals.json",
        exists: true,
        hash: "hash-after",
        file: approvalsFile,
      });
    const opts = createOptions("exec.approvals.set", {
      baseHash: "hash-before",
      file: approvalsFile,
    });

    await execApprovalsHandlers["exec.approvals.set"](opts);

    expect(saveExecApprovalsMock).toHaveBeenCalledWith(approvalsFile);
    expect(opts.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ hash: "hash-after" }),
      undefined,
    );
    expect(opts.context.broadcast).toHaveBeenCalledWith(
      "exec.approvals.changed",
      {
        target: "gateway",
        hash: "hash-after",
        ts: expect.any(Number),
      },
      { dropIfSlow: true },
    );
  });

  it("does not broadcast when gateway approvals fail the base hash guard", async () => {
    readExecApprovalsSnapshotMock.mockReturnValue({
      path: "/tmp/exec-approvals.json",
      exists: true,
      hash: "hash-before",
      file: approvalsFile,
    });
    const opts = createOptions("exec.approvals.set", {
      baseHash: "stale-hash",
      file: approvalsFile,
    });

    await execApprovalsHandlers["exec.approvals.set"](opts);

    expect(saveExecApprovalsMock).not.toHaveBeenCalled();
    expect(opts.context.broadcast).not.toHaveBeenCalled();
    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: "exec approvals changed since last load; re-run exec.approvals.get and retry",
      }),
    );
  });

  it("broadcasts exec.approvals.changed after saving node approvals", async () => {
    const nodePayload = {
      path: "/node/exec-approvals.json",
      exists: true,
      hash: "node-hash-after",
      file: approvalsFile,
    };
    const invoke = vi.fn().mockResolvedValue({
      ok: true,
      payloadJSON: JSON.stringify(nodePayload),
    });
    const opts = createOptions(
      "exec.approvals.node.set",
      {
        nodeId: " node-1 ",
        baseHash: "node-hash-before",
        file: approvalsFile,
      },
      {
        context: {
          broadcast: vi.fn(),
          logGateway: {
            debug: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
          },
          nodeRegistry: { invoke },
        } as never,
      },
    );

    await execApprovalsHandlers["exec.approvals.node.set"](opts);

    expect(invoke).toHaveBeenCalledWith({
      nodeId: "node-1",
      command: "system.execApprovals.set",
      params: { file: approvalsFile, baseHash: "node-hash-before" },
    });
    expect(opts.respond).toHaveBeenCalledWith(true, nodePayload, undefined);
    expect(opts.context.broadcast).toHaveBeenCalledWith(
      "exec.approvals.changed",
      {
        target: "node",
        nodeId: "node-1",
        hash: "node-hash-after",
        ts: expect.any(Number),
      },
      { dropIfSlow: true },
    );
  });
});
