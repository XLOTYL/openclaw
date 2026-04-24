import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { birthaQuery } from "../src/birtha-query.mjs";
import { upsertSessionMirrorEntry } from "../src/session-mirror.mjs";

void test("concurrent session mirror upserts preserve merged refs", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "session-mirror-"));
  const mirrorPath = path.join(tmpDir, "mirror.json");
  await writeFile(mirrorPath, "{}\n", "utf8");

  await Promise.all([
    upsertSessionMirrorEntry({
      filePath: mirrorPath,
      sessionKey: "sess-atomic",
      patch: { workflow_id: "wf-1", engineering_session_id: "eng-1" },
    }),
    upsertSessionMirrorEntry({
      filePath: mirrorPath,
      sessionKey: "sess-atomic",
      patch: { run_id: "run-1", verification_report_ref: "artifact://verification_report/vr-1" },
    }),
  ]);

  const mirror = JSON.parse(await readFile(mirrorPath, "utf8"));
  assert.deepEqual(mirror["sess-atomic"], {
    workflow_id: "wf-1",
    engineering_session_id: "eng-1",
    run_id: "run-1",
    verification_report_ref: "artifact://verification_report/vr-1",
    updated_at: mirror["sess-atomic"].updated_at,
  });
});

void test("birthaQuery returns the primary response when session mirror persistence fails", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "birtha-mirror-fail-"));
  const lockedDir = path.join(tmpDir, "locked");
  const mirrorPath = path.join(lockedDir, "mirror.json");
  await writeFile(path.join(tmpDir, "seed.txt"), "seed\n", "utf8");
  await chmod(tmpDir, 0o500);

  const server = http.createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/api/ai/query") {
      res.writeHead(404);
      res.end();
      return;
    }
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ workflow_id: "wf-best-effort", result: { final_response: "ok" } }));
    });
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const response = await birthaQuery({
      birthaApiBaseUrl: `http://127.0.0.1:${port}`,
      prompt: "Best effort mirror",
      openclawEnvelope: {
        sessionKey: "sess-best-effort",
        channel: "operator_shell",
        sender: "user-1",
        idempotencyKey: "idem-best-effort-1",
      },
      sessionMirrorFilePath: mirrorPath,
    });
    assert.equal(response.workflow_id, "wf-best-effort");
  } finally {
    await chmod(tmpDir, 0o700);
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});
