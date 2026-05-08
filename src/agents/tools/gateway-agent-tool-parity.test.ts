import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Gateway parity: string-literal RPC names in agent tools plus an allowlisted scan of
 * `callGateway({ method: "…" })` sites. See `docs/reference/gateway-agent-tool-parity.json`.
 */

type ParitySurfaces = Record<string, string[]>;

type ParityFile = {
  version: number;
  description?: string;
  surfaces: ParitySurfaces;
  dynamic_gateway_methods?: string[];
  dynamic_gateway_method_sources?: string[];
};

const __dirname = dirname(fileURLToPath(import.meta.url));

function readToolSource(relativeFromAgentsTools: string): string {
  return readFileSync(join(__dirname, relativeFromAgentsTools), "utf8");
}

function readAgentsSource(relativeFromAgentsDir: string): string {
  return readFileSync(join(__dirname, "..", relativeFromAgentsDir), "utf8");
}

/** Captures the first string literal argument to `callGatewayTool("…")` or `callGateway("…")`. */
function extractGatewayMethodsFromSource(source: string): Set<string> {
  const out = new Set<string>();
  const re = /callGateway(?:Tool)?\(\s*"([^"]+)"/g;
  let match: RegExpExecArray | null = re.exec(source);
  while (match !== null) {
    out.add(match[1]);
    match = re.exec(source);
  }
  return out;
}

/** Gateway RPC names from `callGateway({ method: "…" })` (and typed variants). */
function extractDynamicGatewayMethodsFromSource(source: string): Set<string> {
  const out = new Set<string>();
  const re = /method:\s*"([a-z][a-z0-9_.]*)"/g;
  let match: RegExpExecArray | null = re.exec(source);
  while (match !== null) {
    out.add(match[1]);
    match = re.exec(source);
  }
  return out;
}

function resolveDynamicSourcePath(entry: string): string {
  const prefixTools = "openclaw/src/agents/tools/";
  const prefixAgents = "openclaw/src/agents/";
  if (entry.startsWith(prefixTools)) {
    return join(__dirname, entry.slice(prefixTools.length));
  }
  if (entry.startsWith(prefixAgents)) {
    return join(__dirname, "..", entry.slice(prefixAgents.length));
  }
  throw new Error(`Unexpected dynamic_gateway_method_sources entry: ${entry}`);
}

function sortedArray(set: Set<string>): string[] {
  return [...set].sort((a, b) => a.localeCompare(b));
}

describe("gateway-agent-tool-parity.json", () => {
  it("matches callGatewayTool/callGateway string literals in core and extended tool sources", () => {
    const matrixPath = join(__dirname, "../../../docs/reference/gateway-agent-tool-parity.json");
    const raw = readFileSync(matrixPath, "utf8");
    const matrix = JSON.parse(raw) as ParityFile;
    expect(matrix.version).toBeGreaterThanOrEqual(2);

    const operator = extractGatewayMethodsFromSource(readToolSource("./operator-tool.ts"));
    const gateway = extractGatewayMethodsFromSource(readToolSource("./gateway-tool.ts"));
    const cron = extractGatewayMethodsFromSource(readToolSource("./cron-tool.ts"));

    const nodes = new Set<string>();
    for (const rel of [
      "./nodes-tool.ts",
      "./nodes-tool-commands.ts",
      "./nodes-tool-media.ts",
      "./nodes-utils.ts",
    ]) {
      for (const m of extractGatewayMethodsFromSource(readToolSource(rel))) {
        nodes.add(m);
      }
    }

    expect(sortedArray(operator)).toEqual(
      [...(matrix.surfaces.operator ?? [])].sort((a, b) => a.localeCompare(b)),
    );
    expect(sortedArray(gateway)).toEqual(
      [...(matrix.surfaces.gateway ?? [])].sort((a, b) => a.localeCompare(b)),
    );
    expect(sortedArray(nodes)).toEqual([...(matrix.surfaces.nodes ?? [])].sort((a, b) => a.localeCompare(b)));
    expect(sortedArray(cron)).toEqual([...(matrix.surfaces.cron ?? [])].sort((a, b) => a.localeCompare(b)));

    const sessionsLifecycle = extractGatewayMethodsFromSource(readToolSource("./sessions-lifecycle-tool.ts"));
    expect(sortedArray(sessionsLifecycle)).toEqual(
      [...(matrix.surfaces.sessions_lifecycle ?? [])].sort((a, b) => a.localeCompare(b)),
    );

    const piHooks = extractGatewayMethodsFromSource(readAgentsSource("pi-tools.before-tool-call.ts"));
    expect(sortedArray(piHooks)).toEqual(
      [...(matrix.surfaces.pi_plugin_hooks ?? [])].sort((a, b) => a.localeCompare(b)),
    );

    const bashExec = new Set<string>();
    for (const rel of [
      "bash-tools.exec-host-node.ts",
      "bash-tools.exec-approval-request.ts",
      "bash-tools.exec-approval-followup.ts",
    ]) {
      for (const m of extractGatewayMethodsFromSource(readAgentsSource(rel))) {
        bashExec.add(m);
      }
    }
    expect(sortedArray(bashExec)).toEqual(
      [...(matrix.surfaces.bash_exec ?? [])].sort((a, b) => a.localeCompare(b)),
    );

    const canvas = extractGatewayMethodsFromSource(readToolSource("./canvas-tool.ts"));
    expect(sortedArray(canvas)).toEqual([...(matrix.surfaces.canvas ?? [])].sort((a, b) => a.localeCompare(b)));
  });

  it("matches dynamic callGateway method strings against the allowlisted agent sources", () => {
    const matrixPath = join(__dirname, "../../../docs/reference/gateway-agent-tool-parity.json");
    const raw = readFileSync(matrixPath, "utf8");
    const matrix = JSON.parse(raw) as ParityFile;

    const entries = matrix.dynamic_gateway_method_sources;
    const expectedMethods = matrix.dynamic_gateway_methods;
    expect(Array.isArray(entries)).toBe(true);
    expect(Array.isArray(expectedMethods)).toBe(true);

    const found = new Set<string>();
    for (const entry of entries ?? []) {
      const path = resolveDynamicSourcePath(entry);
      const source = readFileSync(path, "utf8");
      for (const m of extractDynamicGatewayMethodsFromSource(source)) {
        found.add(m);
      }
    }

    expect(sortedArray(found)).toEqual([...(expectedMethods ?? [])].sort((a, b) => a.localeCompare(b)));
  });
});
