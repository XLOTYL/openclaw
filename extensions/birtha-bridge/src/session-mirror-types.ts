/**
 * Shell-local Birtha continuity mirror (Phase 2).
 *
 * For agents: values are copied only from successful Birtha API responses;
 * never invented on the shell. See CONTINUITY.md and session-mirror.v1.json.
 */

export type BirthaMirrorState = {
  engineering_session_id?: string;
  task_id?: string;
  run_id?: string;
  dossier_id?: string;
  selected_executor?: string;
  problem_brief_ref?: string;
  engineering_state_ref?: string;
  active_task_packet_ref?: string;
  verification_report_ref?: string;
  escalation_packet_ref?: string;
  knowledge_pool_assessment_ref?: string;
};

export type SessionMirrorDocument = {
  mirror_version: 1;
  openclaw_session_key: string;
  birtha_state: BirthaMirrorState;
  updated_at: string;
};
