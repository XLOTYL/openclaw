/**
 * Extract opaque continuity fields from a Birtha ``POST /api/ai/query`` JSON body.
 *
 * For agents: reads ``result.referential_state`` only; does not fetch artifacts.
 */

import type { BirthaMirrorState } from "./session-mirror-types.js";

const REF_KEYS: (keyof BirthaMirrorState)[] = [
  "engineering_session_id",
  "task_id",
  "run_id",
  "dossier_id",
  "selected_executor",
  "problem_brief_ref",
  "engineering_state_ref",
  "active_task_packet_ref",
  "verification_report_ref",
  "escalation_packet_ref",
  "knowledge_pool_assessment_ref",
];

export function extractBirthaMirrorStateFromResponse(payload: unknown): BirthaMirrorState {
  const out: BirthaMirrorState = {};
  if (!payload || typeof payload !== "object") {
    return out;
  }
  const root = payload as Record<string, unknown>;
  const inner = root.result;
  if (!inner || typeof inner !== "object") {
    return out;
  }
  const r = inner as Record<string, unknown>;
  const ref = r.referential_state;
  if (!ref || typeof ref !== "object") {
    return out;
  }
  const rs = ref as Record<string, unknown>;
  for (const key of REF_KEYS) {
    const v = rs[key as string];
    if (typeof v === "string" && v.length > 0) {
      out[key] = v;
    }
  }
  return out;
}
