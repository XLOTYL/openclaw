import { describe, expect, it } from "vitest";
import {
  CORE_GATEWAY_METHODS_EXCLUDED_FROM_DISCOVERY,
  listGatewayMethods,
} from "./server-methods-list.js";
import { coreGatewayHandlers } from "./server-methods.js";

describe("gateway discovery list vs core handlers", () => {
  it("lists every core handler method except the discovery exclusion set", () => {
    const listed = new Set(listGatewayMethods());
    const excluded = new Set<string>(CORE_GATEWAY_METHODS_EXCLUDED_FROM_DISCOVERY);
    const missing: string[] = [];
    for (const method of Object.keys(coreGatewayHandlers)) {
      if (excluded.has(method)) {
        continue;
      }
      if (!listed.has(method)) {
        missing.push(method);
      }
    }
    expect(missing, `Add to BASE_METHODS in server-methods-list (or adjust exclusions): ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("does not advertise connect in the discovery list", () => {
    expect(listGatewayMethods()).not.toContain("connect");
  });
});
