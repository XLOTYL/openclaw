/**
 * Gateway Prometheus-style metrics (process-local).
 *
 * Intended for lightweight security and operational telemetry on the OpenClaw
 * gateway HTTP surface. Values reset on process restart; there is no
 * cross-process aggregation here.
 *
 * Other agents: extend `renderPrometheusMetrics()` when adding new series so
 * `/metrics` stays a complete snapshot of registered counters.
 */

/** Composite key for a labeled counter sample (surface + reason). */
type LabeledCounterKey = `${string}\t${string}`;

const securityBlockTotals = new Map<LabeledCounterKey, number>();

function labeledCounterKey(surface: string, reason: string): LabeledCounterKey {
  return `${surface}\t${reason}`;
}

/**
 * Increment a security-related counter (e.g. blocked system-role injection).
 * Safe to call from hot paths; uses in-memory arithmetic only.
 */
export function incrementOpenclawSecurityBlockTotal(surface: string, reason: string): void {
  const key = labeledCounterKey(surface, reason);
  securityBlockTotals.set(key, (securityBlockTotals.get(key) ?? 0) + 1);
}

/**
 * Render all registered counters in Prometheus text exposition format.
 */
export function renderPrometheusMetrics(): string {
  const lines: string[] = [
    "# HELP openclaw_security_block_total Count of blocked or demoted untrusted injection attempts on gateway HTTP APIs.",
    "# TYPE openclaw_security_block_total counter",
  ];
  for (const [key, value] of securityBlockTotals.entries()) {
    const [surface, reason] = key.split("\t");
    const escSurface = prometheusEscapeLabelValue(surface);
    const escReason = prometheusEscapeLabelValue(reason);
    lines.push(`openclaw_security_block_total{surface="${escSurface}",reason="${escReason}"} ${String(value)}`);
  }
  lines.push("");
  return lines.join("\n");
}

function prometheusEscapeLabelValue(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

/** Vitest-only: clears counters between cases. */
export function __resetOpenclawMetricsForTest(): void {
  securityBlockTotals.clear();
}
