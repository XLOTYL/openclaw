import { expect } from "vitest";
import type { OpenClawConfig } from "../api.js";
import {
  createMemoryDeleteTool,
  createMemoryGetTool,
  createMemorySearchTool,
  createMemoryUpdateTool,
  createMemoryWriteTool,
} from "./tools.js";

export function asOpenClawConfig(config: Partial<OpenClawConfig>): OpenClawConfig {
  return config;
}

export function createDefaultMemoryToolConfig(): OpenClawConfig {
  return asOpenClawConfig({ agents: { list: [{ id: "main", default: true }] } });
}

export function createMemorySearchToolOrThrow(params?: {
  config?: OpenClawConfig;
  agentSessionKey?: string;
}) {
  const tool = createMemorySearchTool({
    config: params?.config ?? createDefaultMemoryToolConfig(),
    ...(params?.agentSessionKey ? { agentSessionKey: params.agentSessionKey } : {}),
  });
  if (!tool) {
    throw new Error("tool missing");
  }
  return tool;
}

export function createMemoryGetToolOrThrow(
  config: OpenClawConfig = createDefaultMemoryToolConfig(),
) {
  const tool = createMemoryGetTool({ config });
  if (!tool) {
    throw new Error("tool missing");
  }
  return tool;
}

export function createMemoryWriteToolOrThrow(
  config: OpenClawConfig = createDefaultMemoryToolConfig(),
) {
  const tool = createMemoryWriteTool({ config });
  if (!tool) {
    throw new Error("tool missing");
  }
  return tool;
}

export function createMemoryUpdateToolOrThrow(
  config: OpenClawConfig = createDefaultMemoryToolConfig(),
) {
  const tool = createMemoryUpdateTool({ config });
  if (!tool) {
    throw new Error("tool missing");
  }
  return tool;
}

export function createMemoryDeleteToolOrThrow(
  config: OpenClawConfig = createDefaultMemoryToolConfig(),
) {
  const tool = createMemoryDeleteTool({ config });
  if (!tool) {
    throw new Error("tool missing");
  }
  return tool;
}

export function createAutoCitationsMemorySearchTool(agentSessionKey: string) {
  return createMemorySearchToolOrThrow({
    config: asOpenClawConfig({
      memory: { citations: "auto" },
      agents: { list: [{ id: "main", default: true }] },
    }),
    agentSessionKey,
  });
}

export function expectUnavailableMemorySearchDetails(
  details: unknown,
  params: {
    error: string;
    warning: string;
    action: string;
  },
) {
  expect(details).toEqual({
    results: [],
    disabled: true,
    unavailable: true,
    error: params.error,
    warning: params.warning,
    action: params.action,
    debug: {
      warning: params.warning,
      action: params.action,
      error: params.error,
    },
  });
}
