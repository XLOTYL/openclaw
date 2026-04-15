/**
 * Operator CLI for the Birtha session mirror (read-only show + clear).
 */

import type { Command } from "commander";
import { clearSessionMirror, loadSessionMirror, resolveMirrorDir } from "./session-mirror-store.js";

export function registerBirthaBridgeCli(program: Command, rootDir?: string) {
  const mirrorDir = resolveMirrorDir(rootDir);
  const birtha = program
    .command("birtha")
    .description(
      "Birtha bridge operator commands (shell-local mirror; Birtha stays authoritative)",
    );

  const session = birtha
    .command("session")
    .description("Session mirror under ~/.openclaw/birtha-bridge/mirrors");

  session
    .command("show")
    .requiredOption("--session-key <key>", "OpenClaw session_key used with birtha_query")
    .action(async (opts: { sessionKey: string }) => {
      const doc = await loadSessionMirror(mirrorDir, opts.sessionKey);
      if (!doc) {
        process.stdout.write("No mirror on disk for this session_key.\n");
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`${JSON.stringify(doc, null, 2)}\n`);
    });

  session
    .command("clear")
    .requiredOption("--session-key <key>", "Remove mirror file (does not change Birtha state)")
    .action(async (opts: { sessionKey: string }) => {
      const ok = await clearSessionMirror(mirrorDir, opts.sessionKey);
      process.stdout.write(ok ? "Mirror cleared.\n" : "No mirror file found.\n");
      process.exitCode = ok ? 0 : 1;
    });
}
