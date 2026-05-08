import { beforeEach, describe, expect, it } from "vitest";
import {
  resetMemoryToolMockState,
  setMemoryDeleteFileImpl,
  setMemoryBackend,
  setMemoryUpdateFileImpl,
  setMemoryWriteFileImpl,
  setMemorySearchImpl,
} from "./memory-tool-manager-mock.js";
import {
  createMemoryDeleteToolOrThrow,
  createMemorySearchToolOrThrow,
  createMemoryUpdateToolOrThrow,
  createMemoryWriteToolOrThrow,
  expectUnavailableMemorySearchDetails,
} from "./tools.test-helpers.js";

describe("memory_search unavailable payloads", () => {
  beforeEach(() => {
    resetMemoryToolMockState({ searchImpl: async () => [] });
  });

  it("returns explicit unavailable metadata for quota failures", async () => {
    setMemorySearchImpl(async () => {
      throw new Error("openai embeddings failed: 429 insufficient_quota");
    });

    const tool = createMemorySearchToolOrThrow();
    const result = await tool.execute("quota", { query: "hello" });
    expectUnavailableMemorySearchDetails(result.details, {
      error: "openai embeddings failed: 429 insufficient_quota",
      warning: "Memory search is unavailable because the embedding provider quota is exhausted.",
      action: "Top up or switch embedding provider, then retry memory_search.",
    });
  });

  it("returns explicit unavailable metadata for non-quota failures", async () => {
    setMemorySearchImpl(async () => {
      throw new Error("embedding provider timeout");
    });

    const tool = createMemorySearchToolOrThrow();
    const result = await tool.execute("generic", { query: "hello" });
    expectUnavailableMemorySearchDetails(result.details, {
      error: "embedding provider timeout",
      warning: "Memory search is unavailable due to an embedding/provider error.",
      action: "Check embedding provider configuration and retry memory_search.",
    });
  });

  it("returns structured search debug metadata for qmd results", async () => {
    setMemoryBackend("qmd");
    setMemorySearchImpl(async (opts) => {
      opts?.onDebug?.({
        backend: "qmd",
        configuredMode: opts.qmdSearchModeOverride ?? "query",
        effectiveMode: "query",
        fallback: "unsupported-search-flags",
      });
      return [
        {
          path: "MEMORY.md",
          startLine: 1,
          endLine: 2,
          score: 0.9,
          snippet: "ramen",
          source: "memory",
        },
      ];
    });

    const tool = createMemorySearchToolOrThrow({
      config: {
        plugins: {
          entries: {
            "active-memory": {
              config: {
                qmd: {
                  searchMode: "search",
                },
              },
            },
          },
        },
        memory: {
          backend: "qmd",
          qmd: {
            searchMode: "query",
            limits: {
              maxInjectedChars: 1000,
            },
          },
        },
      },
      agentSessionKey: "agent:main:main:active-memory:debug",
    });
    const result = await tool.execute("debug", { query: "favorite food" });
    expect(result.details).toMatchObject({
      mode: "query",
      debug: {
        backend: "qmd",
        configuredMode: "search",
        effectiveMode: "query",
        fallback: "unsupported-search-flags",
        hits: 1,
      },
    });
    expect((result.details as { debug?: { searchMs?: number } }).debug?.searchMs).toEqual(
      expect.any(Number),
    );
  });
});

describe("memory mutation tools", () => {
  beforeEach(() => {
    resetMemoryToolMockState({ searchImpl: async () => [] });
  });

  it("memory_write returns path and bytes", async () => {
    setMemoryWriteFileImpl(async (params) => ({
      path: params.relPath,
      bytes: 12,
    }));
    const tool = createMemoryWriteToolOrThrow();
    const result = await tool.execute("write", { path: "memory/tasks.md", content: "hello world!" });
    expect(result.details).toMatchObject({
      ok: true,
      path: "memory/tasks.md",
      bytes: 12,
      changed: true,
    });
  });

  it("memory_update supports ranged updates", async () => {
    setMemoryUpdateFileImpl(async (params) => ({
      path: params.relPath,
      bytes: 22,
    }));
    const tool = createMemoryUpdateToolOrThrow();
    const result = await tool.execute("update", {
      path: "memory/tasks.md",
      content: "done",
      from: 2,
      lines: 1,
    });
    expect(result.details).toMatchObject({
      ok: true,
      path: "memory/tasks.md",
      bytes: 22,
      changed: true,
    });
  });

  it("memory_delete returns deleted state", async () => {
    setMemoryDeleteFileImpl(async (params) => ({
      path: params.relPath,
      deleted: false,
    }));
    const tool = createMemoryDeleteToolOrThrow();
    const result = await tool.execute("delete", { path: "memory/tasks.md" });
    expect(result.details).toMatchObject({
      ok: true,
      path: "memory/tasks.md",
      deleted: false,
    });
  });
});
