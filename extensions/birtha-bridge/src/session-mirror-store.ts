/**
 * Filesystem-backed session mirror with atomic replace.
 *
 * For agents: storage lives under ``~/.openclaw/birtha-bridge/mirrors`` or
 * ``<plugin.rootDir>/.birtha-bridge/mirrors`` when ``rootDir`` is set.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { extractBirthaMirrorStateFromResponse } from "./session-mirror-extract.js";
import type { BirthaMirrorState, SessionMirrorDocument } from "./session-mirror-types.js";

export function resolveMirrorDir(rootDir?: string): string {
  if (rootDir && rootDir.length > 0) {
    return join(rootDir, ".birtha-bridge", "mirrors");
  }
  return join(homedir(), ".openclaw", "birtha-bridge", "mirrors");
}

function sessionKeyToFilename(sessionKey: string): string {
  const h = createHash("sha256").update(sessionKey, "utf8").digest("hex").slice(0, 48);
  return `${h}.json`;
}

function mirrorPath(mirrorDir: string, sessionKey: string): string {
  return join(mirrorDir, sessionKeyToFilename(sessionKey));
}

export async function loadSessionMirror(
  mirrorDir: string,
  sessionKey: string,
): Promise<SessionMirrorDocument | null> {
  const p = mirrorPath(mirrorDir, sessionKey);
  try {
    const raw = await readFile(p, "utf8");
    const doc = JSON.parse(raw) as SessionMirrorDocument;
    if (doc && doc.mirror_version === 1 && typeof doc.openclaw_session_key === "string") {
      return doc;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveSessionMirrorFromResponse(params: {
  mirrorDir: string;
  sessionKey: string;
  birthaJson: unknown;
}): Promise<void> {
  const extracted = extractBirthaMirrorStateFromResponse(params.birthaJson);
  const prev = await loadSessionMirror(params.mirrorDir, params.sessionKey);
  const merged: BirthaMirrorState = { ...prev?.birtha_state, ...extracted };
  const doc: SessionMirrorDocument = {
    mirror_version: 1,
    openclaw_session_key: params.sessionKey,
    birtha_state: merged,
    updated_at: new Date().toISOString(),
  };
  await writeSessionMirrorAtomic(params.mirrorDir, params.sessionKey, doc);
}

export async function writeSessionMirrorAtomic(
  mirrorDir: string,
  sessionKey: string,
  doc: SessionMirrorDocument,
): Promise<void> {
  await mkdir(mirrorDir, { recursive: true });
  const finalPath = mirrorPath(mirrorDir, sessionKey);
  const tmpPath = `${finalPath}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  await rename(tmpPath, finalPath);
}

export async function clearSessionMirror(mirrorDir: string, sessionKey: string): Promise<boolean> {
  try {
    await unlink(mirrorPath(mirrorDir, sessionKey));
    return true;
  } catch {
    return false;
  }
}

export function mergeContinuityFromMirror(
  mirror: SessionMirrorDocument | null,
  explicit: BirthaMirrorState,
): BirthaMirrorState {
  const base = mirror?.birtha_state ?? {};
  const out: BirthaMirrorState = { ...base };
  for (const key of Object.keys(explicit) as (keyof BirthaMirrorState)[]) {
    const v = explicit[key];
    if (typeof v === "string" && v.length > 0) {
      out[key] = v;
    }
  }
  return out;
}
