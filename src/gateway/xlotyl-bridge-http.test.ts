import { describe, expect, it } from "vitest";
import { AUTH_TOKEN, createRequest, createResponse } from "./server-http.test-harness.js";
import { handleXlotylBridgeHttpRequest } from "./xlotyl-bridge-http.js";
import { withTempConfig } from "./test-temp-config.js";

describe("xlotyl bridge HTTP", () => {
  it("returns 503 when xlotyl integration is disabled", async () => {
    await withTempConfig({
      prefix: "xlotyl-bridge-disabled",
      cfg: {
        gateway: { trustedProxies: [] },
        xlotyl: { enabled: false },
      },
      run: async () => {
        const req = createRequest({
          path: "/xlotyl/v1/surface",
          method: "GET",
          authorization: "Bearer test-token",
          host: "127.0.0.1:18789",
        });
        const { res, getBody } = createResponse();
        const handled = await handleXlotylBridgeHttpRequest(req, res, {
          auth: AUTH_TOKEN,
          trustedProxies: [],
        });
        expect(handled).toBe(true);
        expect(res.statusCode).toBe(503);
        const body = JSON.parse(getBody());
        expect(body.ok).toBe(false);
        expect(body.error?.type).toBe("xlotyl_bridge_disabled");
      },
    });
  });

  it("returns normalized surface when enabled but agent-platform is unreachable", async () => {
    await withTempConfig({
      prefix: "xlotyl-surface-unreachable",
      cfg: {
        gateway: { trustedProxies: [] },
        xlotyl: {
          enabled: true,
          agentPlatformBaseUrl: "http://127.0.0.1:9",
          requestTimeoutMs: 800,
        },
      },
      run: async () => {
        const req = createRequest({
          path: "/xlotyl/v1/surface",
          method: "GET",
          authorization: "Bearer test-token",
          host: "127.0.0.1:18789",
        });
        const { res, getBody } = createResponse();
        const handled = await handleXlotylBridgeHttpRequest(req, res, {
          auth: AUTH_TOKEN,
          trustedProxies: [],
        });
        expect(handled).toBe(true);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(getBody());
        expect(body.ok).toBe(true);
        expect(body.surface?.schema).toBe("xlotyl.ui.surface/v1");
        expect(body.surface?.agentPlatform?.reachable).toBe(false);
      },
    });
  });

  it("returns false when path is not xlotyl bridge", async () => {
    await withTempConfig({
      prefix: "xlotyl-not-match",
      cfg: { gateway: { trustedProxies: [] }, xlotyl: { enabled: true, agentPlatformBaseUrl: "http://127.0.0.1:8087" } },
      run: async () => {
        const req = createRequest({ path: "/other", method: "GET" });
        const { res } = createResponse();
        const handled = await handleXlotylBridgeHttpRequest(req, res, { auth: AUTH_TOKEN });
        expect(handled).toBe(false);
      },
    });
  });
});
