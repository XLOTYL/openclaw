/**
 * OpenClaw-registered tool: birtha_tool_query — calls POST /api/ai/tool-query (class B registry).
 */
import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-runtime";
import { jsonResult, readStringParam } from "openclaw/plugin-sdk/provider-web-search";
import { birthaToolQuery } from "./birtha-tool-query.js";

function resolveBirthaApiBaseUrl(api: OpenClawPluginApi): string | null {
  const fromEnv = process.env.BIRTHA_API_BASE_URL ?? process.env.XLOTYL_API_URL;
  if (fromEnv?.trim()) {
    return fromEnv.trim().replace(/\/$/, "");
  }
  const cfg = api.pluginConfig as { birthaApiBaseUrl?: string } | undefined;
  if (cfg?.birthaApiBaseUrl?.trim()) {
    return cfg.birthaApiBaseUrl.trim().replace(/\/$/, "");
  }
  return null;
}

function resolveBearerToken(): string | undefined {
  const t = process.env.BIRTHA_API_TOKEN ?? process.env.XLOTYL_API_TOKEN;
  return t?.trim() || undefined;
}

const BirthaToolQueryParameters = Type.Object(
  {
    tool_name: Type.String({
      minLength: 1,
      description: "Registered class-B tool name (see registry.v1.json).",
    }),
    tool_version: Type.String({ minLength: 1, description: "Tool semver or build id." }),
    tool_goal: Type.String({
      minLength: 1,
      description: "Immediate objective; avoid full chat history.",
    }),
    input_payload: Type.Record(Type.String(), Type.Unknown(), {
      description: "Minimal structured input for this tool call.",
    }),
    tool_schema_expected: Type.Optional(
      Type.Record(Type.String(), Type.Unknown(), {
        description: "JSON Schema fragment for structured output validation server-side.",
      }),
    ),
    openclaw_bridge: Type.Record(Type.String(), Type.Unknown(), {
      description:
        "Bridge context: idempotency_key, tool_call_id, correlation_id — not full transcript.",
    }),
    max_tokens: Type.Optional(Type.Number({ minimum: 1, maximum: 32768 })),
    timeout_budget_ms: Type.Optional(Type.Number({ minimum: 1, maximum: 600_000 })),
    needs_citations: Type.Optional(Type.Boolean({ default: false })),
    needs_structured_output: Type.Optional(Type.Boolean({ default: true })),
    session_ref: Type.Optional(Type.String()),
    allowed_capabilities: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

export function createBirthaToolModelTool(api: OpenClawPluginApi) {
  return {
    name: "birtha_tool_query",
    label: "Birtha tool-model lane",
    description:
      "Calls Xlotyl POST /api/ai/tool-query for class-B (AI-assisted shell) tools. " +
      "Responses are non-authoritative (lane=tool_model); set BIRTHA_API_BASE_URL or plugins.entries.birtha-bridge.birthaApiBaseUrl.",
    parameters: BirthaToolQueryParameters,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const baseUrl = resolveBirthaApiBaseUrl(api);
      if (!baseUrl) {
        return jsonResult({
          error: true,
          message:
            "Missing Birtha API base URL. Set BIRTHA_API_BASE_URL (or XLOTYL_API_URL) or plugin config birthaApiBaseUrl.",
        });
      }

      const toolName = readStringParam(rawParams, "tool_name", { required: true });
      const toolVersion = readStringParam(rawParams, "tool_version", { required: true });
      const toolGoal = readStringParam(rawParams, "tool_goal", { required: true });
      const inputPayload = rawParams.input_payload;
      if (!inputPayload || typeof inputPayload !== "object" || Array.isArray(inputPayload)) {
        return jsonResult({
          error: true,
          message: "input_payload must be a JSON object.",
        });
      }
      const bridge = rawParams.openclaw_bridge;
      if (!bridge || typeof bridge !== "object" || Array.isArray(bridge)) {
        return jsonResult({
          error: true,
          message: "openclaw_bridge must be a JSON object.",
        });
      }

      const toolSchemaExpected =
        rawParams.tool_schema_expected !== undefined
          ? (rawParams.tool_schema_expected as Record<string, unknown>)
          : undefined;
      if (
        toolSchemaExpected !== undefined &&
        (typeof toolSchemaExpected !== "object" ||
          toolSchemaExpected === null ||
          Array.isArray(toolSchemaExpected))
      ) {
        return jsonResult({
          error: true,
          message: "tool_schema_expected must be a JSON object when set.",
        });
      }

      const maxTokens =
        typeof rawParams.max_tokens === "number" && Number.isFinite(rawParams.max_tokens)
          ? rawParams.max_tokens
          : undefined;
      const timeoutBudgetMs =
        typeof rawParams.timeout_budget_ms === "number" &&
        Number.isFinite(rawParams.timeout_budget_ms)
          ? rawParams.timeout_budget_ms
          : undefined;

      try {
        const out = await birthaToolQuery({
          birthaApiBaseUrl: baseUrl,
          bearerToken: resolveBearerToken(),
          toolName,
          toolVersion,
          toolGoal,
          inputPayload: inputPayload as Record<string, unknown>,
          toolSchemaExpected: toolSchemaExpected,
          openclawBridge: bridge as Record<string, unknown>,
          maxTokens,
          timeoutBudgetMs,
          needsCitations: rawParams.needs_citations === true,
          needsStructuredOutput: rawParams.needs_structured_output !== false,
          sessionRef: typeof rawParams.session_ref === "string" ? rawParams.session_ref : undefined,
          allowedCapabilities: Array.isArray(rawParams.allowed_capabilities)
            ? (rawParams.allowed_capabilities as string[])
            : undefined,
        });
        return jsonResult(out);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return jsonResult({ error: true, message: msg });
      }
    },
  };
}
