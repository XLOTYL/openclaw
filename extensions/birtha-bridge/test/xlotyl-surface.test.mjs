import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildXlotylSurfaceDocument,
  registerXlotylSurfaceRoute,
  shouldRegisterXlotylSurface,
} from "../src/xlotyl-surface.mjs";

void test("registerXlotylSurfaceRoute only wires the route when xlotyl bridge config is enabled", async () => {
  let registered = null;
  registerXlotylSurfaceRoute({
    config: {
      xlotyl: {
        enabled: true,
        agentPlatformBaseUrl: "http://127.0.0.1:9999",
      },
    },
    registerHttpRoute(route) {
      registered = route;
    },
  });

  assert.equal(shouldRegisterXlotylSurface({ xlotyl: { enabled: false } }), false);
  assert.ok(registered);
  assert.equal(registered.path, "/xlotyl/v1/surface");
  assert.equal(registered.auth, "gateway");
});

void test("xlotyl surface route returns a normalized surface document", async () => {
  const priorFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ status: "healthy" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  let registered = null;
  registerXlotylSurfaceRoute({
    config: {
      xlotyl: {
        enabled: true,
        surfaceEnabled: true,
        agentPlatformBaseUrl: "http://127.0.0.1:9999",
        requestTimeoutMs: 1000,
      },
    },
    registerHttpRoute(route) {
      registered = route;
    },
  });

  try {
    const req = { method: "GET" };
    const responseState = { body: "" };
    const res = {
      statusCode: 0,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      end(value) {
        responseState.body = value;
      },
    };

    const handled = await registered.handler(req, res);
    assert.equal(handled, true);
    assert.equal(res.statusCode, 200);
    const payload = JSON.parse(responseState.body);
    assert.equal(payload.bridge.authority, "xlotyl");
    assert.equal(payload.connectivity.reachable, true);
    assert.equal(payload.governed_surfaces.ai_query.path, "/api/ai/query");
    assert.equal(payload.bridge_capabilities.session_mirror.authoritative, false);
  } finally {
    globalThis.fetch = priorFetch;
  }
});

void test("buildXlotylSurfaceDocument reports unreachable agent-platform health checks", async () => {
  const priorFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("connect ECONNREFUSED");
  };

  try {
    const payload = await buildXlotylSurfaceDocument({
      xlotyl: {
        enabled: true,
        agentPlatformBaseUrl: "http://127.0.0.1:9999",
      },
    });
    assert.equal(payload.connectivity.reachable, false);
    assert.match(payload.connectivity.detail, /ECONNREFUSED/);
  } finally {
    globalThis.fetch = priorFetch;
  }
});
