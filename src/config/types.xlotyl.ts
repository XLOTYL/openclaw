import type { SecretInput } from "./types.secrets.js";

/**
 * Integration with xlotyl `agent-platform`: proxy UI surface + frontend module hints.
 * Workflows stay API-first on agent-platform; OpenClaw does not run LangGraph here.
 */
export type XlotylIntegrationConfig = {
  /** Master toggle for `/xlotyl/v1/*` gateway routes and fetch helpers. */
  enabled?: boolean;
  /** Base URL for agent-platform (e.g. http://127.0.0.1:8087). */
  agentPlatformBaseUrl?: string;
  /** Optional bearer token for server-side requests to agent-platform (never expose to browsers). */
  agentPlatformToken?: SecretInput;
  /** Request timeout when calling agent-platform (ms). Default 15000. */
  requestTimeoutMs?: number;
  /**
   * When false, disables `/xlotyl/v1/*` routes even if enabled=true (default: true when enabled and URL set).
   */
  surfaceEnabled?: boolean;
};
