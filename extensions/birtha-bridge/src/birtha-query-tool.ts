/**
 * Birtha `POST /api/ai/query` tool — builds `context.openclaw_bridge` per
 * `schemas/openclaw-bridge/v1/openclaw-bridge-envelope.schema.json`.
 *
 * For agents: loads a shell-local session mirror (Phase 2) so continuity ids
 * and opaque refs resubmit without manual copy; overwrites mirror only from
 * successful Birtha JSON responses. Never synthesizes governed values.
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
  saveSessionMirrorFromResponse,
} from "./session-mirror-store.js";
import type { BirthaMirrorState } from "./session-mirror-types.js";

function optionalStringEnum<const T extends readonly string[]>(values: T) {
  return Type.Optional(
    Type.Unsafe<T[number]>({
      type: "string",
      enum: [...values],
    }),
  );
}

const BirthaQueryToolSchema = Type.Object(
  {
    prompt: Type.String({ description: "User prompt forwarded as QueryRequest.prompt." }),
    session_key: Type.String({ description: "OpenClaw session identity (bridge.session_key)." }),
    channel: Type.String({ description: "Channel id or type (telegram, webchat, …)." }),
    sender: Type.String({ description: "Stable sender id for dedupe policy." }),
    idempotency_key: Type.Optional(
      Type.String({
        description:
          "Per-turn idempotency key (min 8 chars server-side). Defaults to a new UUID per call.",
        minLength: 8,
        maxLength: 256,
      }),
    ),
    engagement_mode: optionalStringEnum([
      "casual_chat",
      "ideation",
      "napkin_math",
      "engineering",
      "engineering_task",
      "strict_engineering",
    ] as const),
    model: Type.Optional(Type.String()),
    provider: Type.Optional(Type.String()),
    system: Type.Optional(Type.String()),
    engineering_session_id: Type.Optional(Type.String()),
    task_id: Type.Optional(Type.String()),
    run_id: Type.Optional(Type.String()),
    dossier_id: Type.Optional(Type.String()),
    attachments: Type.Optional(
      Type.Unsafe<unknown[]>({
        type: "array",
        description: "Forwarded to Birtha; must satisfy bridge attachment policy server-side.",
      }),
    ),
  },
  { additionalProperties: false },
);

export function createBirthaQueryTool(api: OpenClawPluginApi) {
  const mirrorDir = resolveMirrorDir(api.rootDir);
  return {
    name: "birtha_query",
    label: "Birtha query",
    description:
      "Send a governed chat/engineering turn to Birtha via POST /api/ai/query using the openclaw-bridge v1 envelope (idempotency + session mirror continuity).",
    parameters: BirthaQueryToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const prompt = readStringParam(rawParams, "prompt", { required: true });
      const sessionKey = readStringParam(rawParams, "session_key", { required: true });
      const channel = readStringParam(rawParams, "channel", { required: true });
      const sender = readStringParam(rawParams, "sender", { required: true });
      let idempotencyKey = readStringParam(rawParams, "idempotency_key");
      if (!idempotencyKey) {
        idempotencyKey = randomUUID();
      }
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
      const attachments = Array.isArray(rawParams.attachments) ? rawParams.attachments : [];

      const mirror = await loadSessionMirror(mirrorDir, sessionKey);
      const merged = mergeContinuityFromMirror(mirror, explicit);

      const { context } = buildOpenclawBridgeContext({
        sessionKey,
        channel,
        sender,
        idempotencyKey,
        attachments,
        merged,
        streaming: false,
      });

      const body: Record<string, unknown> = {
        prompt,
        context,
      };
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
        accept: "application/json",
      };
      if (bearer) {
        headers.authorization = `Bearer ${bearer}`;
      }

      const res = await fetch(`${base}/api/ai/query`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let payload: unknown;
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        payload = { raw: text };
      }
      if (!res.ok) {
        return jsonResult({
          ok: false,
          status: res.status,
          birtha_response: payload,
        });
      }
      await saveSessionMirrorFromResponse({
        mirrorDir,
        sessionKey,
        birthaJson: payload,
      });
      return jsonResult({
        ok: true,
        status: res.status,
        birtha_response: payload,
        continuity_hint: {
          engineering_session_id: merged.engineering_session_id ?? null,
          task_id: merged.task_id ?? null,
          run_id: merged.run_id ?? null,
          dossier_id: merged.dossier_id ?? null,
        },
      });
    },
  };
}
