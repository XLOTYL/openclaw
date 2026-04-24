export type BridgeRequestBase = {
  birthaApiBaseUrl: string;
  bearerToken?: string;
  timeoutMs?: number;
};

type QueryValue = string | number | boolean | null | undefined;

function queryValueToString(value: QueryValue): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return `${value}`;
  }
  return undefined;
}

function normalizeBaseUrl(birthaApiBaseUrl: string): string {
  return birthaApiBaseUrl.replace(/\/$/, "");
}

function withTimeout(timeoutMs: number | undefined): AbortSignal | undefined {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined;
  }
  return AbortSignal.timeout(timeoutMs);
}

function buildHeaders(
  bearerToken: string | undefined,
  extra: Record<string, string>,
): Record<string, string> {
  const headers = { ...extra };
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }
  return headers;
}

function buildUrl(
  pathname: string,
  query: Record<string, QueryValue> | undefined,
  base: string,
): string {
  const url = new URL(`${normalizeBaseUrl(base)}${pathname}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    const normalized = queryValueToString(value);
    if (normalized !== undefined) {
      url.searchParams.set(key, normalized);
    }
  }
  return url.toString();
}

export async function parseJsonResponse(
  response: Response,
  label: string,
): Promise<Record<string, unknown>> {
  const text = await response.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`${label}: non-JSON response (${response.status}): ${text.slice(0, 400)}`);
  }
  if (!response.ok) {
    const err = new Error(`${label}: HTTP ${response.status}`);
    (err as Error & { body?: Record<string, unknown> }).body = data;
    throw err;
  }
  return data;
}

export async function bridgePostJson(params: {
  birthaApiBaseUrl: string;
  bearerToken?: string;
  path: string;
  body: Record<string, unknown>;
  label: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  query?: Record<string, QueryValue>;
}): Promise<Record<string, unknown>> {
  const response = await fetch(buildUrl(params.path, params.query, params.birthaApiBaseUrl), {
    method: "POST",
    headers: buildHeaders(params.bearerToken, {
      "Content-Type": "application/json",
      ...params.headers,
    }),
    body: JSON.stringify(params.body),
    signal: withTimeout(params.timeoutMs),
  });
  return parseJsonResponse(response, params.label);
}

export async function bridgeGetJson(params: {
  birthaApiBaseUrl: string;
  bearerToken?: string;
  path: string;
  label: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  query?: Record<string, QueryValue>;
}): Promise<Record<string, unknown>> {
  const response = await fetch(buildUrl(params.path, params.query, params.birthaApiBaseUrl), {
    headers: buildHeaders(params.bearerToken, {
      Accept: "application/json",
      ...params.headers,
    }),
    signal: withTimeout(params.timeoutMs),
  });
  return parseJsonResponse(response, params.label);
}

export async function bridgePostStream(params: {
  birthaApiBaseUrl: string;
  bearerToken?: string;
  path: string;
  body: Record<string, unknown>;
  label: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  query?: Record<string, QueryValue>;
}): Promise<Response> {
  const response = await fetch(buildUrl(params.path, params.query, params.birthaApiBaseUrl), {
    method: "POST",
    headers: buildHeaders(params.bearerToken, {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...params.headers,
    }),
    body: JSON.stringify(params.body),
    signal: withTimeout(params.timeoutMs),
  });
  if (!response.ok) {
    await parseJsonResponse(response, params.label);
  }
  if (!response.body) {
    throw new Error(`${params.label}: response body is missing`);
  }
  return response;
}
