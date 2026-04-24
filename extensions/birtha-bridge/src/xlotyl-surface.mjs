/**
 * ESM runtime (no TypeScript build). Keep in sync with xlotyl-surface.ts.
 */

function normalizeBaseUrl(value) {
  return typeof value === "string" && value.trim() ? value.trim().replace(/\/$/, "") : undefined;
}

export function readXlotylBridgeConfig(config) {
  const root = config && typeof config === "object" ? config : {};
  const raw = root.xlotyl && typeof root.xlotyl === "object" ? root.xlotyl : {};
  return {
    enabled: raw.enabled === true,
    surfaceEnabled: raw.surfaceEnabled !== false,
    agentPlatformBaseUrl: normalizeBaseUrl(
      typeof raw.agentPlatformBaseUrl === "string" ? raw.agentPlatformBaseUrl : undefined,
    ),
    agentPlatformToken:
      typeof raw.agentPlatformToken === "string" && raw.agentPlatformToken.trim()
        ? raw.agentPlatformToken.trim()
        : undefined,
    requestTimeoutMs:
      typeof raw.requestTimeoutMs === "number" &&
      Number.isFinite(raw.requestTimeoutMs) &&
      raw.requestTimeoutMs > 0
        ? raw.requestTimeoutMs
        : 15000,
  };
}

export function shouldRegisterXlotylSurface(config) {
  const xlotyl = readXlotylBridgeConfig(config);
  return xlotyl.enabled && xlotyl.surfaceEnabled && Boolean(xlotyl.agentPlatformBaseUrl);
}

async function probeAgentPlatform(cfg) {
  if (!cfg.agentPlatformBaseUrl) {
    return {
      configured: false,
      reachable: false,
      detail: "missing_agent_platform_base_url",
    };
  }

  try {
    const response = await fetch(`${cfg.agentPlatformBaseUrl}/health`, {
      headers: cfg.agentPlatformToken
        ? { Authorization: `Bearer ${cfg.agentPlatformToken}` }
        : undefined,
      signal: AbortSignal.timeout(cfg.requestTimeoutMs),
    });
    if (!response.ok) {
      return {
        configured: true,
        reachable: false,
        detail: `health_http_${response.status}`,
      };
    }
    return {
      configured: true,
      reachable: true,
      detail: "ok",
      health: await response.json(),
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function buildXlotylSurfaceDocument(config) {
  const xlotyl = readXlotylBridgeConfig(config);
  return {
    bridge: {
      shell: "openclaw",
      authority: "xlotyl",
      policy: "openclaw initiates and observes; xlotyl decides, validates, and publishes",
    },
    connectivity: await probeAgentPlatform(xlotyl),
    governed_surfaces: {
      ai_query: { path: "/api/ai/query", authoritative: true, lane: "governed" },
      ai_query_stream: {
        path: "/api/ai/query/stream",
        authoritative: true,
        lane: "governed",
        transport: "sse",
      },
      workflow_status: {
        path: "/api/ai/workflows/{workflow_id}/status",
        authoritative: true,
        lane: "governed",
      },
      workflow_cancel: {
        path: "/api/ai/workflows/{workflow_id}/cancel",
        authoritative: true,
        lane: "governed",
      },
      running_get: { path: "/api/running", authoritative: true, lane: "governed" },
      running_events_get: {
        path: "/api/running/events",
        authoritative: true,
        lane: "governed",
      },
    },
    bridge_capabilities: {
      birtha_tool_query: { authoritative: false, lane: "tool_model" },
      birtha_query: { authoritative: true, lane: "governed" },
      birtha_query_stream: { authoritative: true, lane: "governed", transport: "sse" },
      birtha_workflow_status: true,
      birtha_workflow_cancel: true,
      birtha_running_get: true,
      birtha_running_events_get: true,
      session_mirror: {
        authoritative: false,
        stored_refs: [
          "workflow_id",
          "engineering_session_id",
          "run_id",
          "problem_brief_ref",
          "engineering_state_ref",
          "active_task_packet_ref",
          "verification_report_ref",
        ],
      },
    },
    frontend_module_hints: {
      recommended_views: ["workflow_status", "running_index", "session_continuity"],
      preferred_transport: "gateway_http_plus_birtha_bridge",
      discovery_doc: "docs/ui-integration-v0.md",
    },
  };
}

function writeJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(body)}\n`);
}

export function registerXlotylSurfaceRoute(api) {
  if (!shouldRegisterXlotylSurface(api.config)) {
    return;
  }

  api.registerHttpRoute({
    path: "/xlotyl/v1/surface",
    auth: "gateway",
    handler: async (req, res) => {
      if (req.method !== "GET") {
        res.statusCode = 405;
        res.setHeader("Allow", "GET");
        res.end("Method Not Allowed");
        return true;
      }

      writeJson(res, 200, await buildXlotylSurfaceDocument(api.config));
      return true;
    },
  });
}
