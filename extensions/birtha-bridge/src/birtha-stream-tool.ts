/**
 * Subscribes to Birtha ``POST /api/ai/query/stream`` (typed SSE MVP).
 *
 * For agents: uses the same session mirror merge rules as ``birtha_query`` so
 * continuity resubmits without duplicating ids in tool args. Stream disconnect
 * does **not** clear the mirror (only operator DELETE/CLI clear or a fresh
 * successful ``birtha_query`` overwrites persisted refs).
 */

import { randomUUID } from "node:crypto";
import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-runtime";
import { jsonResult, readStringParam } from "openclaw/plugin-sdk/provider-web-search";
import {
  buildOpenclawBridgeContext,
  resolveBaseUrl,
  resolveBearer,
} from "./birtha-query-shared.js";
import {
  loadSessionMirror,
  mergeContinuityFromMirror,
  resolveMirrorDir,
} from "./session-mirror-store.js";
import type { BirthaMirrorState } from "./session-mirror-types.js";
import { consumeBirthaQuerySse } from "./sse-client.js";

const BirthaStreamToolSchema = Type.Object(
  {
    prompt: Type.String(),
    session_key: Type.String(),
    channel: Type.String(),
    sender: Type.String(),
    idempotency_key: Type.Optional(Type.String({ minLength: 8, maxLength: 256 })),
    engagement_mode: Type.Optional(Type.String()),
    model: Type.Optional(Type.String()),
    provider: Type.Optional(Type.String()),
    system: Type.Optional(Type.String()),
    engineering_session_id: Type.Optional(Type.String()),
    task_id: Type.Optional(Type.String()),
    run_id: Type.Optional(Type.String()),
    dossier_id: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export function createBirthaQueryStreamTool(api: OpenClawPluginApi) {
  const mirrorDir = resolveMirrorDir(api.rootDir);
  return {
    name: "birtha_query_stream",
    label: "Birtha query (SSE)",
    description:
      "POST the same continuity-aware payload as birtha_query to /api/ai/query/stream and collect typed SSE events (MVP: started/completed/failed; mid-run deltas require agent-platform streaming).",
    parameters: BirthaStreamToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const prompt = readStringParam(rawParams, "prompt", { required: true });
      const sessionKey = readStringParam(rawParams, "session_key", { required: true });
      const channel = readStringParam(rawParams, "channel", { required: true });
      const sender = readStringParam(rawParams, "sender", { required: true });
      const idempotencyKey = readStringParam(rawParams, "idempotency_key") || randomUUID();
      const engagementMode = readStringParam(rawParams, "engagement_mode") || undefined;
      const model = readStringParam(rawParams, "model") || undefined;
      const provider = readStringParam(rawParams, "provider") || undefined;
      const system = readStringParam(rawParams, "system") || undefined;

      const explicit: BirthaMirrorState = {};
      const eid = readStringParam(rawParams, "engineering_session_id");
      const tid = readStringParam(rawParams, "task_id");
      const rid = readStringParam(rawParams, "run_id");
      const did = readStringParam(rawParams, "dossier_id");
      if (eid) {
        explicit.engineering_session_id = eid;
      }
      if (tid) {
        explicit.task_id = tid;
      }
      if (rid) {
        explicit.run_id = rid;
      }
      if (did) {
        explicit.dossier_id = did;
      }

      const mirror = await loadSessionMirror(mirrorDir, sessionKey);
      const merged = mergeContinuityFromMirror(mirror, explicit);

      const { context } = buildOpenclawBridgeContext({
        sessionKey,
        channel,
        sender,
        idempotencyKey,
        attachments: [],
        merged,
        streaming: true,
      });

      const body: Record<string, unknown> = { prompt, context };
      if (engagementMode) {
        body.engagement_mode = engagementMode;
      }
      if (model) {
        body.model = model;
      }
      if (provider) {
        body.provider = provider;
      }
      if (system) {
        body.system = system;
      }

      const base = resolveBaseUrl(api);
      const bearer = resolveBearer(api);
      const headers: Record<string, string> = {
        "content-type": "application/json",
        accept: "text/event-stream",
      };
      if (bearer) {
        headers.authorization = `Bearer ${bearer}`;
      }

      const res = await fetch(`${base}/api/ai/query/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const events: Record<string, unknown>[] = [];
      let disconnect: string | null = null;
      if (res.ok && res.body) {
        await consumeBirthaQuerySse({
          response: res,
          onEvent: (ev) => {
            events.push(ev);
          },
          onDisconnect: (r) => {
            disconnect = r;
          },
        });
      } else {
        const t = await res.text();
        return jsonResult({
          ok: false,
          status: res.status,
          body_preview: t.slice(0, 2000),
        });
      }
      return jsonResult({
        ok: true,
        events,
        stream_interrupted: disconnect,
        note:
          disconnect === null
            ? null
            : "Stream ended abnormally; Phase 2 session mirror on disk was not cleared — retry or use birtha_query if you need a persisted referential_state refresh.",
      });
    },
  };
}
