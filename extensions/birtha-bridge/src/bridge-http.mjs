/**
 * ESM runtime (no TypeScript build). Keep in sync with bridge-http.ts.
 */

function normalizeBaseUrl(birthaApiBaseUrl) {
  return birthaApiBaseUrl.replace(/\/$/, "");
}

function withTimeout(timeoutMs) {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined;
  }
  return AbortSignal.timeout(timeoutMs);
}

function buildHeaders(bearerToken, extra) {
  const headers = { ...extra };
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }
  return headers;
}

function queryValueToString(value) {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return `${value}`;
  }
  return undefined;
}

function buildUrl(pathname, query, base) {
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

export async function parseJsonResponse(response, label) {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${label}: non-JSON response (${response.status}): ${text.slice(0, 400)}`);
  }
  if (!response.ok) {
    const err = new Error(`${label}: HTTP ${response.status}`);
    err.body = data;
    throw err;
  }
  return data;
}

export async function bridgePostJson(params) {
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

export async function bridgeGetJson(params) {
  const response = await fetch(buildUrl(params.path, params.query, params.birthaApiBaseUrl), {
    headers: buildHeaders(params.bearerToken, {
      Accept: "application/json",
      ...params.headers,
    }),
    signal: withTimeout(params.timeoutMs),
  });
  return parseJsonResponse(response, params.label);
}

export async function bridgePostStream(params) {
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
