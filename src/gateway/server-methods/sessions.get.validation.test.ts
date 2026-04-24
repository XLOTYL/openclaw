import { describe, expect, it, vi } from "vitest";
import { sessionsHandlers } from "./sessions.js";

describe("sessions.get validation", () => {
  it("rejects malformed params before session store lookup", () => {
    const respond = vi.fn();

    void sessionsHandlers["sessions.get"]({
      params: { unexpected: true },
      respond,
    } as never);

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("invalid sessions.get params"),
      }),
    );
  });
});
