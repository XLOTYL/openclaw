import fs from "node:fs/promises";
import path from "node:path";
import { resolveAgentWorkspaceDir } from "../../agents/agent-scope.js";
import { resolveMemorySearchConfig } from "../../agents/memory-search.js";
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import { isFileMissingError, statRegularFile } from "./fs-utils.js";
import { isMemoryPath, normalizeExtraMemoryPaths } from "./internal.js";

export async function readMemoryFile(params: {
  workspaceDir: string;
  extraPaths?: string[];
  relPath: string;
  from?: number;
  lines?: number;
}): Promise<{ text: string; path: string }> {
  const rawPath = params.relPath.trim();
  if (!rawPath) {
    throw new Error("path required");
  }
  const absPath = path.isAbsolute(rawPath)
    ? path.resolve(rawPath)
    : path.resolve(params.workspaceDir, rawPath);
  const relPath = path.relative(params.workspaceDir, absPath).replace(/\\/g, "/");
  const inWorkspace = relPath.length > 0 && !relPath.startsWith("..") && !path.isAbsolute(relPath);
  const allowedWorkspace = inWorkspace && isMemoryPath(relPath);
  let allowedAdditional = false;
  if (!allowedWorkspace && (params.extraPaths?.length ?? 0) > 0) {
    const additionalPaths = normalizeExtraMemoryPaths(params.workspaceDir, params.extraPaths);
    for (const additionalPath of additionalPaths) {
      try {
        const stat = await fs.lstat(additionalPath);
        if (stat.isSymbolicLink()) {
          continue;
        }
        if (stat.isDirectory()) {
          if (absPath === additionalPath || absPath.startsWith(`${additionalPath}${path.sep}`)) {
            allowedAdditional = true;
            break;
          }
          continue;
        }
        if (stat.isFile() && absPath === additionalPath && absPath.endsWith(".md")) {
          allowedAdditional = true;
          break;
        }
      } catch {}
    }
  }
  if (!allowedWorkspace && !allowedAdditional) {
    throw new Error("path required");
  }
  if (!absPath.endsWith(".md")) {
    throw new Error("path required");
  }
  const statResult = await statRegularFile(absPath);
  if (statResult.missing) {
    return { text: "", path: relPath };
  }
  let content: string;
  try {
    content = await fs.readFile(absPath, "utf-8");
  } catch (err) {
    if (isFileMissingError(err)) {
      return { text: "", path: relPath };
    }
    throw err;
  }
  if (!params.from && !params.lines) {
    return { text: content, path: relPath };
  }
  const fileLines = content.split("\n");
  const start = Math.max(1, params.from ?? 1);
  const count = Math.max(1, params.lines ?? fileLines.length);
  const slice = fileLines.slice(start - 1, start - 1 + count);
  return { text: slice.join("\n"), path: relPath };
}

export async function readAgentMemoryFile(params: {
  cfg: OpenClawConfig;
  agentId: string;
  relPath: string;
  from?: number;
  lines?: number;
}): Promise<{ text: string; path: string }> {
  const settings = resolveMemorySearchConfig(params.cfg, params.agentId);
  if (!settings) {
    throw new Error("memory search disabled");
  }
  return await readMemoryFile({
    workspaceDir: resolveAgentWorkspaceDir(params.cfg, params.agentId),
    extraPaths: settings.extraPaths,
    relPath: params.relPath,
    from: params.from,
    lines: params.lines,
  });
}

function resolveWritableMemoryPath(params: { workspaceDir: string; relPath: string }) {
  const rawPath = params.relPath.trim();
  if (!rawPath) {
    throw new Error("path required");
  }
  const absPath = path.isAbsolute(rawPath)
    ? path.resolve(rawPath)
    : path.resolve(params.workspaceDir, rawPath);
  const relPath = path.relative(params.workspaceDir, absPath).replace(/\\/g, "/");
  const inWorkspace = relPath.length > 0 && !relPath.startsWith("..") && !path.isAbsolute(relPath);
  if (!inWorkspace || !isMemoryPath(relPath) || !absPath.endsWith(".md")) {
    throw new Error("path required");
  }
  return { absPath, relPath };
}

export async function writeMemoryFile(params: {
  workspaceDir: string;
  relPath: string;
  content: string;
}): Promise<{ path: string; bytes: number }> {
  const { absPath, relPath } = resolveWritableMemoryPath({
    workspaceDir: params.workspaceDir,
    relPath: params.relPath,
  });
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, params.content, "utf-8");
  return { path: relPath, bytes: Buffer.byteLength(params.content, "utf-8") };
}

export async function updateMemoryFile(params: {
  workspaceDir: string;
  relPath: string;
  content: string;
  from?: number;
  lines?: number;
}): Promise<{ path: string; bytes: number }> {
  if (params.from == null && params.lines == null) {
    return await writeMemoryFile({
      workspaceDir: params.workspaceDir,
      relPath: params.relPath,
      content: params.content,
    });
  }
  const { absPath, relPath } = resolveWritableMemoryPath({
    workspaceDir: params.workspaceDir,
    relPath: params.relPath,
  });
  let existing = "";
  try {
    existing = await fs.readFile(absPath, "utf-8");
  } catch (err) {
    if (!isFileMissingError(err)) {
      throw err;
    }
  }
  const start = Math.max(1, params.from ?? 1);
  const count = Math.max(1, params.lines ?? 1);
  const lines = existing.split("\n");
  const replacement = params.content.split("\n");
  lines.splice(start - 1, count, ...replacement);
  const nextContent = lines.join("\n");
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, nextContent, "utf-8");
  return { path: relPath, bytes: Buffer.byteLength(nextContent, "utf-8") };
}

export async function deleteMemoryFile(params: {
  workspaceDir: string;
  relPath: string;
}): Promise<{ path: string; deleted: boolean }> {
  const { absPath, relPath } = resolveWritableMemoryPath({
    workspaceDir: params.workspaceDir,
    relPath: params.relPath,
  });
  try {
    await fs.unlink(absPath);
    return { path: relPath, deleted: true };
  } catch (err) {
    if (isFileMissingError(err)) {
      return { path: relPath, deleted: false };
    }
    throw err;
  }
}

export async function writeAgentMemoryFile(params: {
  cfg: OpenClawConfig;
  agentId: string;
  relPath: string;
  content: string;
}): Promise<{ path: string; bytes: number }> {
  const settings = resolveMemorySearchConfig(params.cfg, params.agentId);
  if (!settings) {
    throw new Error("memory search disabled");
  }
  return await writeMemoryFile({
    workspaceDir: resolveAgentWorkspaceDir(params.cfg, params.agentId),
    relPath: params.relPath,
    content: params.content,
  });
}

export async function updateAgentMemoryFile(params: {
  cfg: OpenClawConfig;
  agentId: string;
  relPath: string;
  content: string;
  from?: number;
  lines?: number;
}): Promise<{ path: string; bytes: number }> {
  const settings = resolveMemorySearchConfig(params.cfg, params.agentId);
  if (!settings) {
    throw new Error("memory search disabled");
  }
  return await updateMemoryFile({
    workspaceDir: resolveAgentWorkspaceDir(params.cfg, params.agentId),
    relPath: params.relPath,
    content: params.content,
    from: params.from,
    lines: params.lines,
  });
}

export async function deleteAgentMemoryFile(params: {
  cfg: OpenClawConfig;
  agentId: string;
  relPath: string;
}): Promise<{ path: string; deleted: boolean }> {
  const settings = resolveMemorySearchConfig(params.cfg, params.agentId);
  if (!settings) {
    throw new Error("memory search disabled");
  }
  return await deleteMemoryFile({
    workspaceDir: resolveAgentWorkspaceDir(params.cfg, params.agentId),
    relPath: params.relPath,
  });
}
