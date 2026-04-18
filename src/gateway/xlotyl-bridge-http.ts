import type { IncomingMessage, ServerResponse } from "node:http";
import { loadConfig } from "../config/config.js";
import { normalizeSecretInputString } from "../config/types.secrets.js";
import { planFrontendModules } from "../xlotyl/frontend-operation.js";
import { buildXlotylUiSurface, fetchAgentPlatformHealth } from "../xlotyl/surface-contract.js";
import type { AuthRateLimiter } from "./auth-rate-limit.js";
import type { ResolvedGatewayAuth } from "./auth.js";
import { readJsonBodyOrError, sendJson, sendMethodNotAllowed } from "./http-common.js";
import {
  authorizeGatewayHttpRequestOrReply,
  resolveOpenAiCompatibleHttpOperatorScopes,
} from "./http-utils.js";
import { authorizeOperatorScopesForMethod } from "./method-scopes.js";

const DEFAULT_BODY_BYTES = 64 * 1024;

function resolveXlotylSurfacePath(pathname: string): "surface" | "modules_plan" | null {
  if (pathname === "/xlotyl/v1/surface") {
    return "surface";
  }
  if (pathname === "/xlotyl/v1/modules/plan") {
    return "modules_plan";
  }
  return null;
}

function isXlotylBridgeEnabled(): {
  ok: boolean;
  baseUrl?: string;
  token?: string;
  timeoutMs: number;
} {
  const cfg = loadConfig();
  const x = cfg.xlotyl;
  if (!x?.enabled) {
    return { ok: false, timeoutMs: 15_000 };
  }
  if (x.surfaceEnabled === false) {
    return { ok: false, timeoutMs: x.requestTimeoutMs ?? 15_000 };
  }
  const baseUrl = x.agentPlatformBaseUrl?.trim();
  if (!baseUrl) {
    return { ok: false, timeoutMs: x.requestTimeoutMs ?? 15_000 };
  }
  const token =
    normalizeSecretInputString(x.agentPlatformToken) ??
    (typeof process.env.XLOTYL_AGENT_PLATFORM_TOKEN === "string"
      ? process.env.XLOTYL_AGENT_PLATFORM_TOKEN.trim()
      : undefined);
  return {
    ok: true,
    baseUrl,
    token,
    timeoutMs: x.requestTimeoutMs ?? 15_000,
  };
}

export async function handleXlotylBridgeHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: {
    auth: ResolvedGatewayAuth;
    trustedProxies?: string[];
    allowRealIpFallback?: boolean;
    rateLimiter?: AuthRateLimiter;
  },
): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  } catch {
    return false;
  }
  const kind = resolveXlotylSurfacePath(url.pathname);
  if (!kind) {
    return false;
  }

  const bridge = isXlotylBridgeEnabled();
  if (!bridge.ok || !bridge.baseUrl) {
    sendJson(res, 503, {
      ok: false,
      error: {
        type: "xlotyl_bridge_disabled",
        message:
          "xlotyl bridge is disabled. Set xlotyl.enabled=true and xlotyl.agentPlatformBaseUrl in OpenClaw config.",
      },
    });
    return true;
  }

  const cfg = loadConfig();
  const requestAuth = await authorizeGatewayHttpRequestOrReply({
    req,
    res,
    auth: opts.auth,
    trustedProxies: opts.trustedProxies ?? cfg.gateway?.trustedProxies,
    allowRealIpFallback: opts.allowRealIpFallback ?? cfg.gateway?.allowRealIpFallback,
    rateLimiter: opts.rateLimiter,
  });
  if (!requestAuth) {
    return true;
  }

  const requestedScopes = resolveOpenAiCompatibleHttpOperatorScopes(req, requestAuth);
  const scopeAuth = authorizeOperatorScopesForMethod("agent", requestedScopes);
  if (!scopeAuth.allowed) {
    sendJson(res, 403, {
      ok: false,
      error: {
        type: "forbidden",
        message: `missing scope: ${scopeAuth.missingScope}`,
      },
    });
    return true;
  }

  if (kind === "surface") {
    if (req.method !== "GET") {
      sendMethodNotAllowed(res, "GET");
      return true;
    }
    const healthResult = await fetchAgentPlatformHealth({
      baseUrl: bridge.baseUrl,
      token: bridge.token,
      timeoutMs: bridge.timeoutMs,
    });
    const surface = buildXlotylUiSurface({
      baseUrl: bridge.baseUrl,
      healthResult,
    });
    sendJson(res, 200, { ok: true, surface });
    return true;
  }

  if (kind === "modules_plan") {
    if (req.method !== "POST") {
      sendMethodNotAllowed(res, "POST");
      return true;
    }
    const bodyUnknown = await readJsonBodyOrError(req, res, DEFAULT_BODY_BYTES);
    if (bodyUnknown === undefined) {
      return true;
    }
    const body = (bodyUnknown ?? {}) as { intent?: unknown; keywords?: unknown };
    const intent = typeof body.intent === "string" ? body.intent : undefined;
    const keywords = Array.isArray(body.keywords)
      ? body.keywords.filter((k): k is string => typeof k === "string")
      : undefined;
    const directives = planFrontendModules({ intent, keywords });
    sendJson(res, 200, { ok: true, directives });
    return true;
  }

  return false;
}
