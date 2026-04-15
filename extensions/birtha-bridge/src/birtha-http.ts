/**
 * Minimal gateway HTTP surface for inspecting or clearing the shell-local mirror.
 *
 * For agents: returns opaque ids/refs only; never serves control-plane artifact bodies.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { parse as parseUrl } from "node:url";
import type { PluginLogger } from "openclaw/plugin-sdk/plugin-runtime";
import { clearSessionMirror, loadSessionMirror } from "./session-mirror-store.js";

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(body)}\n`);
}

export function createBirthaBridgeHttpHandler(params: {
  mirrorDir: string;
  logger?: Pick<PluginLogger, "info" | "warn" | "error">;
}) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const u = req.url ? parseUrl(req.url, false) : null;
    const pathname = u?.pathname ?? "";
    if (!pathname.startsWith("/plugins/birtha-bridge")) {
      return false;
    }
    let sessionKey = "";
    if (u?.query && typeof u.query === "string") {
      sessionKey = new URLSearchParams(u.query).get("session_key")?.trim() ?? "";
    } else if (u?.query && typeof u.query === "object" && !Array.isArray(u.query)) {
      const raw = (u.query as Record<string, string | string[] | undefined>).session_key;
      const v = Array.isArray(raw) ? raw[0] : raw;
      sessionKey = typeof v === "string" ? v.trim() : "";
    }
    if (!sessionKey) {
      sendJson(res, 400, {
        error: "missing_session_key",
        message: "Provide session_key query parameter.",
      });
      return true;
    }

    if (req.method === "GET" && pathname.endsWith("/v1/session")) {
      const doc = await loadSessionMirror(params.mirrorDir, sessionKey);
      if (!doc) {
        sendJson(res, 404, { error: "mirror_not_found", session_key: sessionKey });
        return true;
      }
      const bs = doc.birtha_state;
      const refSuffix = (s: string | undefined) =>
        typeof s === "string" && s.length > 8 ? `…${s.slice(-12)}` : (s ?? null);
      sendJson(res, 200, {
        active_birtha_session: true,
        openclaw_session_key: doc.openclaw_session_key,
        updated_at: doc.updated_at,
        engineering_session_id: bs.engineering_session_id ?? null,
        task_id: bs.task_id ?? null,
        run_id: bs.run_id ?? null,
        dossier_id: bs.dossier_id ?? null,
        selected_executor: bs.selected_executor ?? null,
        refs: {
          active_task_packet_ref: refSuffix(bs.active_task_packet_ref),
          problem_brief_ref: refSuffix(bs.problem_brief_ref),
          engineering_state_ref: refSuffix(bs.engineering_state_ref),
          verification_report_ref: refSuffix(bs.verification_report_ref),
          escalation_packet_ref: refSuffix(bs.escalation_packet_ref),
          knowledge_pool_assessment_ref: refSuffix(bs.knowledge_pool_assessment_ref),
        },
      });
      return true;
    }

    if (req.method === "DELETE" && pathname.endsWith("/v1/session")) {
      const removed = await clearSessionMirror(params.mirrorDir, sessionKey);
      if (removed) {
        res.statusCode = 204;
        res.end();
        params.logger?.info?.(
          `[birtha-bridge] cleared session mirror for ${sessionKey.slice(0, 16)}…`,
        );
      } else {
        sendJson(res, 404, { error: "mirror_not_found", session_key: sessionKey });
      }
      return true;
    }

    sendJson(res, 405, { error: "method_not_allowed" });
    return true;
  };
}
