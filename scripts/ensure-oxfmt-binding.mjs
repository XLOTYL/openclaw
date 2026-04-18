#!/usr/bin/env node
/**
 * When npm skips optional @oxfmt/binding-* (e.g. Node below the binding's engine range),
 * `oxfmt` cannot load its native module. Fetch the correct platform tarball with `npm pack`
 * so local tooling (`generate-base-config-schema`, `npm run format`) still works.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const DISABLE = process.env.OPENCLAW_SKIP_OXFMT_BINDING_BOOTSTRAP;

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

/**
 * Map `process.platform` / `process.arch` to the optionalDependency name shipped with `oxfmt`.
 *
 * @returns {string | null}
 */
function bindingPackageName(platform, arch) {
  if (platform === "darwin") {
    if (arch === "arm64") {
      return "@oxfmt/binding-darwin-arm64";
    }
    if (arch === "x64") {
      return "@oxfmt/binding-darwin-x64";
    }
  }
  if (platform === "win32") {
    if (arch === "arm64") {
      return "@oxfmt/binding-win32-arm64-msvc";
    }
    if (arch === "ia32") {
      return "@oxfmt/binding-win32-ia32-msvc";
    }
    if (arch === "x64") {
      return "@oxfmt/binding-win32-x64-msvc";
    }
  }
  if (platform === "linux") {
    if (arch === "arm64") {
      return "@oxfmt/binding-linux-arm64-gnu";
    }
    if (arch === "x64") {
      return "@oxfmt/binding-linux-x64-gnu";
    }
  }
  if (platform === "freebsd" && arch === "x64") {
    return "@oxfmt/binding-freebsd-x64";
  }
  return null;
}

function bindingAlreadyPresent(destDir) {
  if (!existsSync(destDir)) {
    return false;
  }
  try {
    return readdirSync(destDir).some((name) => name.endsWith(".node"));
  } catch {
    return false;
  }
}

function main() {
  if (DISABLE === "1" || DISABLE === "true") {
    return;
  }

  const oxfmtPkgPath = join(REPO_ROOT, "node_modules", "oxfmt", "package.json");
  if (!existsSync(oxfmtPkgPath)) {
    return;
  }

  const oxfmt = readJson(oxfmtPkgPath);
  const optional = oxfmt.optionalDependencies ?? {};
  const pkgName =
    process.env.OXFMT_BINDING_PACKAGE?.trim() || bindingPackageName(process.platform, process.arch);
  if (!pkgName || !optional[pkgName]) {
    return;
  }

  const destDir = join(REPO_ROOT, "node_modules", ...pkgName.split("/"));
  if (bindingAlreadyPresent(destDir)) {
    return;
  }

  const version = optional[pkgName];
  const spec = `${pkgName}@${version}`;
  const tmpDir = mkdtempSync(join(os.tmpdir(), "openclaw-oxfmt-binding-"));
  try {
    const pack = spawnSync(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["pack", spec, "--pack-destination", tmpDir],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    if (pack.status !== 0) {
      console.warn(
        `[openclaw] ensure-oxfmt-binding: npm pack failed for ${spec}: ${pack.stderr?.trim() || pack.stdout?.trim() || "unknown"}`,
      );
      return;
    }
    const tgzLine = pack.stdout.trim().split("\n").filter(Boolean).pop();
    if (!tgzLine) {
      console.warn(`[openclaw] ensure-oxfmt-binding: no tarball path from npm pack for ${spec}`);
      return;
    }
    const tgzPath = join(tmpDir, tgzLine.trim());
    if (!existsSync(tgzPath)) {
      console.warn(`[openclaw] ensure-oxfmt-binding: missing ${tgzPath}`);
      return;
    }

    mkdirSync(destDir, { recursive: true });
    const tar = spawnSync(
      "tar",
      ["-xzf", tgzPath, "-C", destDir, "--strip-components=1"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    if (tar.status !== 0) {
      console.warn(
        `[openclaw] ensure-oxfmt-binding: tar failed: ${tar.stderr?.trim() || tar.stdout?.trim() || "unknown"}`,
      );
      rmSync(destDir, { recursive: true, force: true });
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

main();
