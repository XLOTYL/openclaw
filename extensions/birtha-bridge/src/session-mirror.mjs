/**
 * ESM runtime (no TypeScript build). Keep in sync with session-mirror.ts.
 */

import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const SESSION_MIRROR_KEYS = [
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

function pickString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeRefPatch(raw) {
  const patch = {};
  for (const key of SESSION_MIRROR_KEYS) {
    const value = pickString(raw[key]);
    if (value) {
      patch[key] = value;
    }
  }
  return patch;
}

export function hasSessionMirrorRefs(patch) {
  return SESSION_MIRROR_KEYS.some((key) => typeof patch[key] === "string" && patch[key]);
}

export function extractSessionMirrorPatchFromQueryResponse(response) {
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

function extractReferentialState(response) {
  const inner =
    response.result && typeof response.result === "object" && !Array.isArray(response.result)
      ? response.result
      : {};
  return inner.referential_state &&
    typeof inner.referential_state === "object" &&
    !Array.isArray(inner.referential_state)
    ? inner.referential_state
    : {};
}

export function extractSessionMirrorPatchFromWorkflowStatusResponse(response) {
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

export function extractSessionMirrorPatchFromStreamEvent(event) {
  const payload =
    event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
      ? event.payload
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

export function mergeSessionMirrorEntry(existing, patch) {
  if (!hasSessionMirrorRefs(patch) && !existing) {
    return undefined;
  }
  return {
    ...(existing ?? { updated_at: new Date().toISOString() }),
    ...patch,
    updated_at: new Date().toISOString(),
  };
}

export async function loadSessionMirror(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function saveSessionMirror(filePath, mirror) {
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

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireSessionMirrorLock(filePath) {
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
      if (error?.code !== "EEXIST") {
        throw error;
      }
      await sleep(SESSION_MIRROR_LOCK_RETRY_MS);
    }
  }

  throw new Error(`Timed out acquiring session mirror lock for ${filePath}`);
}

export async function upsertSessionMirrorEntry(params) {
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

export async function bestEffortUpsertSessionMirrorEntry(params) {
  try {
    return await upsertSessionMirrorEntry(params);
  } catch (error) {
    const warn =
      params.warn ??
      ((message, warningError) => {
        console.warn(message, warningError);
      });
    warn(
      `birtha-bridge session mirror persistence failed for ${params.sessionKey ?? "<unknown>"}`,
      error,
    );
    return undefined;
  }
}
