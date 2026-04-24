/**
 * ESM runtime (no TypeScript build). Keep in sync with birtha-running.ts.
 */

import { bridgeGetJson } from "./bridge-http.mjs";

export async function birthaRunningGet(args) {
  return bridgeGetJson({
    birthaApiBaseUrl: args.birthaApiBaseUrl,
    bearerToken: args.bearerToken,
    path: "/api/running",
    label: "birtha_running_get",
    timeoutMs: args.timeoutMs,
    query: {
      limit: args.limit,
    },
  });
}

export async function birthaRunningEventsGet(args) {
  return bridgeGetJson({
    birthaApiBaseUrl: args.birthaApiBaseUrl,
    bearerToken: args.bearerToken,
    path: "/api/running/events",
    label: "birtha_running_events_get",
    timeoutMs: args.timeoutMs,
    query: {
      cursor: args.cursor,
      limit: args.limit,
    },
  });
}
