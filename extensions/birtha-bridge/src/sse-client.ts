/**
 * Minimal SSE reader for Node ``fetch`` streaming bodies.
 *
 * For agents: collapses consecutive ``run.progress`` events with identical
 * ``payload.phase`` to reduce noise; emits raw ``data:`` JSON lines as objects.
 */

export type SseProgressHandler = (event: Record<string, unknown>) => void;

export async function consumeBirthaQuerySse(params: {
  response: Response;
  onEvent: SseProgressHandler;
  onDisconnect?: (reason: string) => void;
}): Promise<void> {
  const body = params.response.body;
  if (!body) {
    params.onDisconnect?.("empty_body");
    return;
  }
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let lastProgressKey: string | null = null;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of block.split("\n")) {
          if (!line.startsWith("data:")) {
            continue;
          }
          const jsonText = line.slice(5).trim();
          if (!jsonText) {
            continue;
          }
          try {
            const ev = JSON.parse(jsonText) as Record<string, unknown>;
            if (ev.type === "run.progress") {
              const p = ev.payload;
              let phase = "";
              if (p && typeof p === "object" && "phase" in p) {
                const maybePhase = (p as { phase?: unknown }).phase;
                phase = typeof maybePhase === "string" ? maybePhase : "";
              } else if (typeof ev.phase === "string") {
                phase = ev.phase;
              }
              const key = phase;
              if (key && key === lastProgressKey) {
                continue;
              }
              lastProgressKey = key || null;
            } else {
              lastProgressKey = null;
            }
            params.onEvent(ev);
          } catch {
            /* ignore malformed line */
          }
        }
      }
    }
  } catch (err) {
    params.onDisconnect?.(err instanceof Error ? err.message : "read_error");
  }
}
