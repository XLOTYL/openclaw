import { bridgeGetJson } from "./bridge-http.js";

export type BirthaRunningGetArgs = {
  birthaApiBaseUrl: string;
  bearerToken?: string;
  limit?: number;
  timeoutMs?: number;
};

export type BirthaRunningEventsGetArgs = {
  birthaApiBaseUrl: string;
  bearerToken?: string;
  cursor?: string;
  limit?: number;
  timeoutMs?: number;
};

export async function birthaRunningGet(
  args: BirthaRunningGetArgs,
): Promise<Record<string, unknown>> {
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

export async function birthaRunningEventsGet(
  args: BirthaRunningEventsGetArgs,
): Promise<Record<string, unknown>> {
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
