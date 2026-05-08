import { describe, expect, it, vi } from "vitest";
import { createGatewayBroadcaster } from "./server-broadcast.js";
import type { GatewayWsClient } from "./server-broadcast-types.js";

type TestSocket = {
  bufferedAmount: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

function client(
  connId: string,
  socket: TestSocket,
  scopes: string[],
): GatewayWsClient {
  return {
    socket: socket as unknown as GatewayWsClient["socket"],
    connect: { role: "operator", scopes } as GatewayWsClient["connect"],
    connId,
    usesSharedGatewayAuth: false,
  };
}

describe("gateway broadcast scope guards", () => {
  it("routes devices.changed and exec.approvals.changed through matching operator scopes", () => {
    const approvalsSocket: TestSocket = {
      bufferedAmount: 0,
      send: vi.fn(),
      close: vi.fn(),
    };
    const pairingSocket: TestSocket = {
      bufferedAmount: 0,
      send: vi.fn(),
      close: vi.fn(),
    };
    const readSocket: TestSocket = {
      bufferedAmount: 0,
      send: vi.fn(),
      close: vi.fn(),
    };

    const clients = new Set<GatewayWsClient>([
      client("c-approvals", approvalsSocket, ["operator.approvals"]),
      client("c-pairing", pairingSocket, ["operator.pairing"]),
      client("c-read", readSocket, ["operator.read"]),
    ]);
    const { broadcast } = createGatewayBroadcaster({ clients });

    broadcast("devices.changed", { deviceId: "device-1", kind: "removed" });
    broadcast("exec.approvals.changed", { target: "gateway", hash: "h1" });

    expect(pairingSocket.send).toHaveBeenCalledTimes(1);
    expect(approvalsSocket.send).toHaveBeenCalledTimes(1);
    expect(readSocket.send).not.toHaveBeenCalled();
  });
});
