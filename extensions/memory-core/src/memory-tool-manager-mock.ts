import type { MemorySearchRuntimeDebug } from "openclaw/plugin-sdk/memory-core-host-runtime-files";
import { vi } from "vitest";

export type SearchImpl = (opts?: {
  maxResults?: number;
  minScore?: number;
  sessionKey?: string;
  qmdSearchModeOverride?: "query" | "search" | "vsearch";
  onDebug?: (debug: MemorySearchRuntimeDebug) => void;
}) => Promise<unknown[]>;
export type MemoryReadParams = { relPath: string; from?: number; lines?: number };
export type MemoryReadResult = { text: string; path: string };
export type MemoryWriteParams = { relPath: string; content: string };
export type MemoryWriteResult = { path: string; bytes: number };
export type MemoryUpdateParams = {
  relPath: string;
  content: string;
  from?: number;
  lines?: number;
};
export type MemoryUpdateResult = { path: string; bytes: number };
export type MemoryDeleteParams = { relPath: string };
export type MemoryDeleteResult = { path: string; deleted: boolean };
type MemoryBackend = "builtin" | "qmd";

let backend: MemoryBackend = "builtin";
let workspaceDir = "/workspace";
let customStatus: Record<string, unknown> | undefined;
let searchImpl: SearchImpl = async () => [];
let readFileImpl: (params: MemoryReadParams) => Promise<MemoryReadResult> = async (params) => ({
  text: "",
  path: params.relPath,
});
let writeFileImpl: (params: MemoryWriteParams) => Promise<MemoryWriteResult> = async (params) => ({
  path: params.relPath,
  bytes: Buffer.byteLength(params.content, "utf-8"),
});
let updateFileImpl: (params: MemoryUpdateParams) => Promise<MemoryUpdateResult> = async (params) => ({
  path: params.relPath,
  bytes: Buffer.byteLength(params.content, "utf-8"),
});
let deleteFileImpl: (params: MemoryDeleteParams) => Promise<MemoryDeleteResult> = async (params) => ({
  path: params.relPath,
  deleted: true,
});

const stubManager = {
  search: vi.fn(async (_query: string, opts?: Parameters<SearchImpl>[0]) => await searchImpl(opts)),
  readFile: vi.fn(async (params: MemoryReadParams) => await readFileImpl(params)),
  status: () => ({
    backend,
    files: 1,
    chunks: 1,
    dirty: false,
    workspaceDir,
    dbPath: "/workspace/.memory/index.sqlite",
    provider: "builtin",
    model: "builtin",
    requestedProvider: "builtin",
    sources: ["memory" as const],
    sourceCounts: [{ source: "memory" as const, files: 1, chunks: 1 }],
    custom: customStatus,
  }),
  sync: vi.fn(),
  probeVectorAvailability: vi.fn(async () => true),
  close: vi.fn(),
};

const getMemorySearchManagerMock = vi.fn(async () => ({ manager: stubManager }));
const readAgentMemoryFileMock = vi.fn(
  async (params: MemoryReadParams) => await readFileImpl(params),
);
const writeAgentMemoryFileMock = vi.fn(
  async (params: MemoryWriteParams) => await writeFileImpl(params),
);
const updateAgentMemoryFileMock = vi.fn(
  async (params: MemoryUpdateParams) => await updateFileImpl(params),
);
const deleteAgentMemoryFileMock = vi.fn(
  async (params: MemoryDeleteParams) => await deleteFileImpl(params),
);

vi.mock("./tools.runtime.js", () => ({
  resolveMemoryBackendConfig: ({
    cfg,
  }: {
    cfg?: { memory?: { backend?: string; qmd?: unknown } };
  }) => ({
    backend,
    qmd: cfg?.memory?.qmd,
  }),
  getMemorySearchManager: getMemorySearchManagerMock,
  readAgentMemoryFile: readAgentMemoryFileMock,
  writeAgentMemoryFile: writeAgentMemoryFileMock,
  updateAgentMemoryFile: updateAgentMemoryFileMock,
  deleteAgentMemoryFile: deleteAgentMemoryFileMock,
}));

export function setMemoryBackend(next: MemoryBackend): void {
  backend = next;
}

export function setMemoryWorkspaceDir(next: string): void {
  workspaceDir = next;
}

export function setMemoryStatusCustom(next: Record<string, unknown> | undefined): void {
  customStatus = next;
}

export function setMemorySearchImpl(next: SearchImpl): void {
  searchImpl = next;
}

export function setMemoryReadFileImpl(
  next: (params: MemoryReadParams) => Promise<MemoryReadResult>,
): void {
  readFileImpl = next;
}

export function setMemoryWriteFileImpl(
  next: (params: MemoryWriteParams) => Promise<MemoryWriteResult>,
): void {
  writeFileImpl = next;
}

export function setMemoryUpdateFileImpl(
  next: (params: MemoryUpdateParams) => Promise<MemoryUpdateResult>,
): void {
  updateFileImpl = next;
}

export function setMemoryDeleteFileImpl(
  next: (params: MemoryDeleteParams) => Promise<MemoryDeleteResult>,
): void {
  deleteFileImpl = next;
}

export function resetMemoryToolMockState(overrides?: {
  backend?: MemoryBackend;
  searchImpl?: SearchImpl;
  readFileImpl?: (params: MemoryReadParams) => Promise<MemoryReadResult>;
  writeFileImpl?: (params: MemoryWriteParams) => Promise<MemoryWriteResult>;
  updateFileImpl?: (params: MemoryUpdateParams) => Promise<MemoryUpdateResult>;
  deleteFileImpl?: (params: MemoryDeleteParams) => Promise<MemoryDeleteResult>;
}): void {
  backend = overrides?.backend ?? "builtin";
  workspaceDir = "/workspace";
  customStatus = undefined;
  searchImpl = overrides?.searchImpl ?? (async () => []);
  readFileImpl =
    overrides?.readFileImpl ??
    (async (params: MemoryReadParams) => ({ text: "", path: params.relPath }));
  writeFileImpl =
    overrides?.writeFileImpl ??
    (async (params: MemoryWriteParams) => ({
      path: params.relPath,
      bytes: Buffer.byteLength(params.content, "utf-8"),
    }));
  updateFileImpl =
    overrides?.updateFileImpl ??
    (async (params: MemoryUpdateParams) => ({
      path: params.relPath,
      bytes: Buffer.byteLength(params.content, "utf-8"),
    }));
  deleteFileImpl =
    overrides?.deleteFileImpl ??
    (async (params: MemoryDeleteParams) => ({ path: params.relPath, deleted: true }));
  vi.clearAllMocks();
}

export function getMemorySearchManagerMockCalls(): number {
  return getMemorySearchManagerMock.mock.calls.length;
}

export function getReadAgentMemoryFileMockCalls(): number {
  return readAgentMemoryFileMock.mock.calls.length;
}
