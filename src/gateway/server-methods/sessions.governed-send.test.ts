import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionEntry } from "../../config/sessions/types.js";
import type { GatewayRequestContext, RespondFn } from "./types.js";

const loadConfigMock = vi.fn();
const updateSessionStoreMock = vi.fn();
const loadSessionEntryMock = vi.fn();
const loadGatewaySessionRowMock = vi.fn();
const readSessionMessagesMock = vi.fn();
const birthaQueryStreamMock = vi.fn();
const birthaWorkflowCancelMock = vi.fn();
const chatSendMock = vi.fn();
const emitSessionTranscriptUpdateMock = vi.fn();

vi.mock("../../config/config.js", async () => {
  const actual =
    await vi.importActual<typeof import("../../config/config.js")>("../../config/config.js");
  return {
    ...actual,
    loadConfig: (...args: unknown[]) => loadConfigMock(...args),
  };
});

vi.mock("../../config/sessions.js", async () => {
  const actual = await vi.importActual<typeof import("../../config/sessions.js")>(
    "../../config/sessions.js",
  );
  return {
    ...actual,
    updateSessionStore: (...args: unknown[]) => updateSessionStoreMock(...args),
  };
});

vi.mock("../session-utils.js", async () => {
  const actual = await vi.importActual<typeof import("../session-utils.js")>("../session-utils.js");
  return {
    ...actual,
    loadSessionEntry: (...args: unknown[]) => loadSessionEntryMock(...args),
    loadGatewaySessionRow: (...args: unknown[]) => loadGatewaySessionRowMock(...args),
    readSessionMessages: (...args: unknown[]) => readSessionMessagesMock(...args),
  };
});

vi.mock("../../../extensions/birtha-bridge/index.ts", () => ({
  birthaQueryStream: (...args: unknown[]) => birthaQueryStreamMock(...args),
  birthaWorkflowCancel: (...args: unknown[]) => birthaWorkflowCancelMock(...args),
}));

vi.mock("./chat.js", () => ({
  chatHandlers: {
    "chat.send": (...args: unknown[]) => chatSendMock(...args),
    "chat.abort": vi.fn(),
  },
}));

vi.mock("../../sessions/transcript-events.js", () => ({
  emitSessionTranscriptUpdate: (...args: unknown[]) => emitSessionTranscriptUpdateMock(...args),
}));

import { sessionsHandlers } from "./sessions.js";

describe("governed session routing", () => {
  let tempDir: string;
  let storePath: string;
  let sessionFile: string;
  let store: Record<string, SessionEntry>;
  const sessionKey = "agent:main:governed";
  const sessionId = "sess-governed";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "openclaw-governed-session-"));
    storePath = path.join(tempDir, "sessions.json");
    sessionFile = path.join(tempDir, `${sessionId}.jsonl`);
    await mkdir(path.dirname(sessionFile), { recursive: true });
    await writeFile(storePath, "{}\n", "utf8");
    store = {
      [sessionKey]: {
        sessionId,
        sessionFile,
        updatedAt: Date.now(),
        channel: "openclaw.gateway",
        xlotyl: {
          authority: "xlotyl_governed",
          workflow_id: "wf-prev",
          engineering_session_id: "eng-prev",
          run_id: "run-prev",
        },
      },
    };

    loadConfigMock.mockReset();
    updateSessionStoreMock.mockReset();
    loadSessionEntryMock.mockReset();
    loadGatewaySessionRowMock.mockReset();
    readSessionMessagesMock.mockReset();
    birthaQueryStreamMock.mockReset();
    birthaWorkflowCancelMock.mockReset();
    chatSendMock.mockReset();
    emitSessionTranscriptUpdateMock.mockReset();

    loadConfigMock.mockReturnValue({
      plugins: {
        entries: {
          "birtha-bridge": {
            config: {
              birthaApiBaseUrl: "http://birtha.test",
              birthaApiToken: "token-1",
            },
          },
        },
      },
    });
    updateSessionStoreMock.mockImplementation(
      async (_path: string, updater: (next: Record<string, SessionEntry>) => void) => {
        updater(store);
        return store[sessionKey];
      },
    );
    loadSessionEntryMock.mockImplementation(() => ({
      canonicalKey: sessionKey,
      storePath,
      entry: store[sessionKey],
    }));
    loadGatewaySessionRowMock.mockImplementation(() => ({
      sessionId,
      xlotyl: store[sessionKey]?.xlotyl,
      status:
        store[sessionKey]?.xlotyl?.status === "completed"
          ? "done"
          : store[sessionKey]?.xlotyl?.status,
    }));
    readSessionMessagesMock.mockReturnValue([{ role: "user", content: "continue" }]);
  });

  afterEach(async () => {
    await vi.dynamicImportSettled();
    await rm(tempDir, { recursive: true, force: true });
  });

  function createContext(): GatewayRequestContext {
    return {
      chatAbortControllers: new Map(),
      broadcastToConnIds: vi.fn(),
      getSessionEventSubscriberConnIds: () => new Set(["conn-1"]),
      logGateway: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
    } as unknown as GatewayRequestContext;
  }

  it("routes governed sessions.send through Birtha stream and projects the final assistant turn", async () => {
    birthaQueryStreamMock.mockImplementation(async function* stream() {
      yield {
        type: "run.started",
        event_id: "evt-1",
        workflow_id: "wf-1",
        engineering_session_id: "eng-1",
        run_id: "run-1",
      };
      yield {
        type: "run.completed",
        event_id: "evt-2",
        workflow_id: "wf-1",
        engineering_session_id: "eng-1",
        run_id: "run-1",
        payload: {
          final_response: "Governed answer",
          referential_state: {
            workflow_id: "wf-1",
            engineering_session_id: "eng-1",
            run_id: "run-1",
            verification_report_ref: "verify-1",
          },
        },
      };
    });

    const respond = vi.fn() as unknown as RespondFn;
    const context = createContext();

    await sessionsHandlers["sessions.send"]({
      req: { id: "req-1" } as never,
      params: {
        key: sessionKey,
        message: "continue",
        idempotencyKey: "run-governed-1",
      },
      respond,
      context,
      client: null,
      isWebchatConnect: () => false,
    });

    expect(chatSendMock).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        runId: "run-governed-1",
        status: "started",
        messageSeq: 1,
        governed: true,
        authoritative: true,
      }),
      undefined,
    );
    expect(birthaQueryStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        birthaApiBaseUrl: "http://birtha.test",
        bearerToken: "token-1",
        prompt: "continue",
        openclawEnvelope: expect.objectContaining({
          sessionKey,
          workflowId: "wf-prev",
          engineeringSessionId: "eng-prev",
          runId: "run-prev",
          idempotencyKey: "run-governed-1",
        }),
      }),
    );

    await vi.waitFor(() => {
      expect(emitSessionTranscriptUpdateMock).toHaveBeenCalledTimes(2);
    });

    expect(
      emitSessionTranscriptUpdateMock.mock.calls.map(
        (call) => (call[0] as { message: { role?: string } }).message.role,
      ),
    ).toEqual(["user", "assistant"]);
    expect(store[sessionKey]?.xlotyl).toEqual(
      expect.objectContaining({
        authority: "xlotyl_governed",
        workflow_id: "wf-1",
        engineering_session_id: "eng-1",
        run_id: "run-1",
        verification_report_ref: "verify-1",
        status: "completed",
        last_event_id: "evt-2",
      }),
    );
    await vi.waitFor(() => {
      expect(context.chatAbortControllers.size).toBe(0);
    });
    expect((context.broadcastToConnIds as ReturnType<typeof vi.fn>).mock.calls).toEqual(
      expect.arrayContaining([
        [
          "sessions.changed",
          expect.objectContaining({
            sessionKey,
          }),
          expect.any(Set),
          expect.any(Object),
        ],
      ]),
    );
  });

  it("routes governed sessions.abort through Birtha workflow cancel and appends a system event", async () => {
    birthaWorkflowCancelMock.mockResolvedValue({ ok: true });
    const controller = new AbortController();
    const context = createContext();
    context.chatAbortControllers.set("run-governed-2", {
      controller,
      sessionId,
      sessionKey,
      startedAtMs: Date.now(),
      expiresAtMs: Date.now() + 60_000,
    });
    const respond = vi.fn() as unknown as RespondFn;

    await sessionsHandlers["sessions.abort"]({
      req: { id: "req-2" } as never,
      params: {
        key: sessionKey,
        runId: "run-governed-2",
      },
      respond,
      context,
      client: null,
      isWebchatConnect: () => false,
    });

    expect(birthaWorkflowCancelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        birthaApiBaseUrl: "http://birtha.test",
        bearerToken: "token-1",
        workflowId: "wf-prev",
      }),
    );
    expect(controller.signal.aborted).toBe(true);
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        ok: true,
        abortedRunId: "run-governed-2",
        status: "aborted",
      },
      undefined,
    );
    expect(emitSessionTranscriptUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          role: "system",
          content: "Governed workflow cancel requested.",
        }),
      }),
    );
    expect(store[sessionKey]?.xlotyl?.status).toBe("cancel_requested");
  });
});
