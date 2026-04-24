import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { birthaQueryStream } from "../src/birtha-query-stream.mjs";
import { birthaQuery } from "../src/birtha-query.mjs";
import { birthaRunningGet, birthaRunningEventsGet } from "../src/birtha-running.mjs";
import { birthaWorkflowCancel } from "../src/birtha-workflow-cancel.mjs";
import { birthaWorkflowStatus } from "../src/birtha-workflow-status.mjs";

void test("birthaQuery posts governed JSON and updates the session mirror", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "birtha-bridge-"));
  const mirrorPath = path.join(tmpDir, "mirror.json");

  const server = http.createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/api/ai/query") {
      res.writeHead(404);
      res.end();
      return;
    }
    let buf = "";
    req.on("data", (chunk) => {
      buf += chunk;
    });
    req.on("end", () => {
      const parsed = JSON.parse(buf);
      assert.equal(parsed.prompt, "Ship governed bridge");
      assert.deepEqual(parsed.context.openclaw_bridge, {
        bridge: { proto: "birtha.openclaw", version: "1.0.0" },
        session_key: "sess-1",
        channel: "operator_shell",
        sender: "user-1",
        idempotency_key: "idem-key-0001",
        attachments: [],
        client_capabilities: {},
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          workflow_id: "wf-1",
          result: {
            final_response: "ok",
            referential_state: {
              engineering_session_id: "eng-1",
              run_id: "run-1",
              problem_brief_ref: "artifact://problem_brief/pb-1",
              engineering_state_ref: "artifact://engineering_state/es-1",
              active_task_packet_ref: "artifact://task_packet/tp-1",
              verification_report_ref: "artifact://verification_report/vr-1",
            },
          },
        }),
      );
    });
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const response = await birthaQuery({
      birthaApiBaseUrl: `http://127.0.0.1:${port}`,
      prompt: "Ship governed bridge",
      openclawEnvelope: {
        sessionKey: "sess-1",
        channel: "operator_shell",
        sender: "user-1",
        idempotencyKey: "idem-key-0001",
      },
      sessionMirrorFilePath: mirrorPath,
    });
    assert.equal(response.workflow_id, "wf-1");

    const mirror = JSON.parse(await readFile(mirrorPath, "utf8"));
    assert.equal(mirror["sess-1"].workflow_id, "wf-1");
    assert.equal(mirror["sess-1"].engineering_session_id, "eng-1");
    assert.equal(mirror["sess-1"].verification_report_ref, "artifact://verification_report/vr-1");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

void test("birthaQuery rejects an incomplete governed envelope before network I/O", async () => {
  let requestCount = 0;
  const server = http.createServer((req, res) => {
    requestCount += 1;
    res.writeHead(500);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    await assert.rejects(
      birthaQuery({
        birthaApiBaseUrl: `http://127.0.0.1:${port}`,
        prompt: "Should fail locally",
        openclawEnvelope: {
          sessionKey: "sess-2",
          channel: "operator_shell",
          idempotencyKey: "idem-key-0002",
        },
      }),
      /sender/i,
    );
    assert.equal(requestCount, 0);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

void test("birthaQueryStream parses SSE events and mirrors workflow continuity refs", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "birtha-bridge-stream-"));
  const mirrorPath = path.join(tmpDir, "mirror.json");
  let parsedRequestBody = null;

  const server = http.createServer((req, res) => {
    if (req.method !== "POST" || !req.url.startsWith("/api/ai/query/stream")) {
      res.writeHead(404);
      res.end();
      return;
    }
    let buf = "";
    req.on("data", (chunk) => {
      buf += chunk;
    });
    req.on("end", () => {
      parsedRequestBody = JSON.parse(buf);
    });
    assert.match(req.url, /event_cursor=cursor-7/);
    assert.equal(req.headers["last-event-id"], "3");
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.end(
      [
        'data: {"type":"run.started","version":"1.0.0","event_id":"1","ts":"2026-04-23T00:00:00Z"}',
        "",
        'data: {"type":"run.completed","version":"1.0.0","event_id":"2","ts":"2026-04-23T00:00:01Z","workflow_id":"wf-2","engineering_session_id":"eng-2","run_id":"run-2","payload":{"final_response":"done"}}',
        "",
      ].join("\n"),
    );
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const events = [];
    for await (const event of birthaQueryStream({
      birthaApiBaseUrl: `http://127.0.0.1:${port}`,
      prompt: "Stream it",
      openclawEnvelope: {
        sessionKey: "sess-stream",
        channel: "operator_shell",
        sender: "user-2",
        idempotencyKey: "idem-stream-0001",
      },
      sessionMirrorFilePath: mirrorPath,
      lastEventId: "3",
      eventCursor: "cursor-7",
    })) {
      events.push(event);
    }

    assert.deepEqual(
      events.map((event) => event.type),
      ["run.started", "run.completed"],
    );
    assert.equal(parsedRequestBody.context.openclaw_bridge.session_key, "sess-stream");
    const mirror = JSON.parse(await readFile(mirrorPath, "utf8"));
    assert.equal(mirror["sess-stream"].workflow_id, "wf-2");
    assert.equal(mirror["sess-stream"].engineering_session_id, "eng-2");
    assert.equal(mirror["sess-stream"].run_id, "run-2");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

void test("workflow lifecycle helpers refresh the session mirror from status payloads", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "birtha-bridge-status-"));
  const mirrorPath = path.join(tmpDir, "mirror.json");
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push(req.url);
    if (req.method === "GET" && req.url === "/api/ai/workflows/wf-3/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: "wf-3",
          status: "running",
          result: {
            referential_state: {
              engineering_session_id: "eng-3",
              run_id: "run-3",
              problem_brief_ref: "artifact://problem_brief/pb-3",
            },
          },
        }),
      );
      return;
    }
    if (req.method === "POST" && req.url === "/api/ai/workflows/wf-3/cancel") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ cancel_ack: { payload: { workflow_id: "wf-3" } } }));
      return;
    }
    if (req.method === "GET" && req.url === "/api/running?limit=7") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ workflows: [], dev_runs: [] }));
      return;
    }
    if (req.method === "GET" && req.url === "/api/running/events?cursor=9-0&limit=5") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ cursor: "9-0", next_cursor: "10-0", events: [] }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const base = `http://127.0.0.1:${port}`;
    const status = await birthaWorkflowStatus({
      birthaApiBaseUrl: base,
      workflowId: "wf-3",
      sessionKey: "sess-status",
      sessionMirrorFilePath: mirrorPath,
    });
    const cancel = await birthaWorkflowCancel({ birthaApiBaseUrl: base, workflowId: "wf-3" });
    const running = await birthaRunningGet({ birthaApiBaseUrl: base, limit: 7 });
    const events = await birthaRunningEventsGet({
      birthaApiBaseUrl: base,
      cursor: "9-0",
      limit: 5,
    });

    assert.equal(status.status, "running");
    const mirror = JSON.parse(await readFile(mirrorPath, "utf8"));
    assert.equal(mirror["sess-status"].workflow_id, "wf-3");
    assert.equal(mirror["sess-status"].engineering_session_id, "eng-3");
    assert.equal(mirror["sess-status"].run_id, "run-3");
    assert.equal(mirror["sess-status"].problem_brief_ref, "artifact://problem_brief/pb-3");
    assert.equal(cancel.cancel_ack.payload.workflow_id, "wf-3");
    assert.deepEqual(running.workflows, []);
    assert.equal(events.next_cursor, "10-0");
    assert.deepEqual(seen, [
      "/api/ai/workflows/wf-3/status",
      "/api/ai/workflows/wf-3/cancel",
      "/api/running?limit=7",
      "/api/running/events?cursor=9-0&limit=5",
    ]);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});
