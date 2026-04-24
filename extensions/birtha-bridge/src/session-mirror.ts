import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type SessionMirrorRefs = {
  workflow_id?: string;
  engineering_session_id?: string;
  run_id?: string;
  problem_brief_ref?: string;
  engineering_state_ref?: string;
  active_task_packet_ref?: string;
  verification_report_ref?: string;
};

export type SessionMirrorEntry = SessionMirrorRefs & {
  updated_at: string;
};

export type SessionMirrorState = Record<string, SessionMirrorEntry>;

const SESSION_MIRROR_KEYS: Array<keyof SessionMirrorRefs> = [
  "workflow_id",
  "engineering_session_id",
  "run_id",
  "problem_brief_ref",
  "engineering_state_ref",
  "active_task_packet_ref",
  "verification_report_ref",
];
const SESSION_MIRROR_LOCK_RETRY_MS = 10;
const SESSION_MIRROR_LOCK_ATTEMPTS = 200;

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeRefPatch(raw: Record<string, unknown>): SessionMirrorRefs {
  const patch: SessionMirrorRefs = {};
  for (const key of SESSION_MIRROR_KEYS) {
    const value = pickString(raw[key]);
    if (value) {
      patch[key] = value;
    }
  }
  return patch;
}

export function hasSessionMirrorRefs(patch: SessionMirrorRefs): boolean {
  return SESSION_MIRROR_KEYS.some((key) => typeof patch[key] === "string" && patch[key]);
}

export function extractSessionMirrorPatchFromQueryResponse(
  response: Record<string, unknown>,
): SessionMirrorRefs {
  const referentialState = extractReferentialState(response);
  return normalizeRefPatch({
    workflow_id: response.workflow_id,
    engineering_session_id: referentialState.engineering_session_id,
    run_id: referentialState.run_id,
    problem_brief_ref: referentialState.problem_brief_ref,
    engineering_state_ref: referentialState.engineering_state_ref,
    active_task_packet_ref: referentialState.active_task_packet_ref,
    verification_report_ref: referentialState.verification_report_ref,
  });
}

function extractReferentialState(response: Record<string, unknown>): Record<string, unknown> {
  const inner =
    response.result && typeof response.result === "object" && !Array.isArray(response.result)
      ? (response.result as Record<string, unknown>)
      : {};
  return inner.referential_state &&
    typeof inner.referential_state === "object" &&
    !Array.isArray(inner.referential_state)
    ? (inner.referential_state as Record<string, unknown>)
    : {};
}

export function extractSessionMirrorPatchFromWorkflowStatusResponse(
  response: Record<string, unknown>,
): SessionMirrorRefs {
  const referentialState = extractReferentialState(response);
  return normalizeRefPatch({
    workflow_id: response.id ?? response.workflow_id,
    engineering_session_id: referentialState.engineering_session_id,
    run_id: referentialState.run_id,
    problem_brief_ref: referentialState.problem_brief_ref,
    engineering_state_ref: referentialState.engineering_state_ref,
    active_task_packet_ref: referentialState.active_task_packet_ref,
    verification_report_ref: referentialState.verification_report_ref,
  });
}

export function extractSessionMirrorPatchFromStreamEvent(
  event: Record<string, unknown>,
): SessionMirrorRefs {
  const payload =
    event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
      ? (event.payload as Record<string, unknown>)
      : {};
  return normalizeRefPatch({
    workflow_id: event.workflow_id ?? payload.workflow_id,
    engineering_session_id: event.engineering_session_id ?? payload.engineering_session_id,
    run_id: event.run_id ?? payload.run_id,
    problem_brief_ref: payload.problem_brief_ref,
    engineering_state_ref: payload.engineering_state_ref,
    active_task_packet_ref: payload.active_task_packet_ref,
    verification_report_ref: payload.verification_report_ref,
  });
}

export function mergeSessionMirrorEntry(
  existing: SessionMirrorEntry | undefined,
  patch: SessionMirrorRefs,
): SessionMirrorEntry | undefined {
  if (!hasSessionMirrorRefs(patch) && !existing) {
    return undefined;
  }
  const merged: SessionMirrorEntry = {
    ...(existing ?? { updated_at: new Date().toISOString() }),
    ...patch,
    updated_at: new Date().toISOString(),
  };
  return merged;
}

export async function loadSessionMirror(filePath: string): Promise<SessionMirrorState> {
  try {
    const text = await readFile(filePath, "utf8");
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as SessionMirrorState;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function saveSessionMirror(
  filePath: string,
  mirror: SessionMirrorState,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, `${JSON.stringify(mirror, null, 2)}\n`, "utf8");
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireSessionMirrorLock(filePath: string): Promise<() => Promise<void>> {
  const lockPath = `${filePath}.lock`;
  await mkdir(path.dirname(filePath), { recursive: true });

  for (let attempt = 0; attempt < SESSION_MIRROR_LOCK_ATTEMPTS; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.close();
      return async () => {
        await rm(lockPath, { force: true });
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code !== "EEXIST") {
        throw error;
      }
      await sleep(SESSION_MIRROR_LOCK_RETRY_MS);
    }
  }

  throw new Error(`Timed out acquiring session mirror lock for ${filePath}`);
}

export async function upsertSessionMirrorEntry(params: {
  filePath?: string;
  sessionKey?: string;
  patch: SessionMirrorRefs;
}): Promise<SessionMirrorEntry | undefined> {
  if (!params.filePath || !params.sessionKey || !hasSessionMirrorRefs(params.patch)) {
    return undefined;
  }
  const releaseLock = await acquireSessionMirrorLock(params.filePath);
  try {
    const mirror = await loadSessionMirror(params.filePath);
    const next = mergeSessionMirrorEntry(mirror[params.sessionKey], params.patch);
    if (!next) {
      return undefined;
    }
    mirror[params.sessionKey] = next;
    await saveSessionMirror(params.filePath, mirror);
    return next;
  } finally {
    await releaseLock();
  }
}

export async function bestEffortUpsertSessionMirrorEntry(params: {
  filePath?: string;
  sessionKey?: string;
  patch: SessionMirrorRefs;
  warn?: (message: string, error: unknown) => void;
}): Promise<SessionMirrorEntry | undefined> {
  try {
    return await upsertSessionMirrorEntry(params);
  } catch (error) {
    const warn =
      params.warn ??
      ((message: string, warningError: unknown) => {
        console.warn(message, warningError);
      });
    warn(
      `birtha-bridge session mirror persistence failed for ${params.sessionKey ?? "<unknown>"}`,
      error,
    );
    return undefined;
  }
}
