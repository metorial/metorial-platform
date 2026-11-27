import { describe, expect, it } from 'vitest';
import {
  checkConduitHeartbeat,
  checkConduitHeartbeatFleet,
  checkConduitSelfHealth,
  ConduitHeartbeatError
} from '../src';
import { conduit } from '../src/lib/conduit';

let fleetOf = (receivers: string[]) => ({ getActiveReceivers: async () => receivers });

describe('module-connection health checks', () => {
  it('gets a matching pong from a worker through the conduit heartbeat', async () => {
    let flag = process.env.CONDUIT_FLEET_HEALTH;
    delete process.env.CONDUIT_FLEET_HEALTH;

    try {
      let pong = await checkConduitHeartbeat({ id: 'e2e-heartbeat', timeoutMs: 5_000 });
      expect(pong).toMatchObject({ type: 'health.pong', id: 'e2e-heartbeat' });
    } finally {
      if (flag !== undefined) process.env.CONDUIT_FLEET_HEALTH = flag;
    }
  });

  it('probes every active receiver of the stack fleet', async () => {
    let receivers = await conduit.coordination.getActiveReceivers();
    expect(receivers.length).toBeGreaterThanOrEqual(1);

    let result = await checkConduitHeartbeatFleet({ startupGraceMs: 0, timeoutMs: 5_000 });
    expect(result).toMatchObject({
      activeReceivers: receivers.length,
      probed: receivers.length
    });

    let self = await checkConduitSelfHealth({ receiverId: receivers[0]!, timeoutMs: 5_000 });
    expect(self).toEqual({ receiverId: receivers[0], ready: true });
  });

  it('reports a receiver that never answers as wedged', async () => {
    let missing = `e2e-missing-receiver-${Date.now()}`;

    await expect(
      checkConduitHeartbeatFleet({
        coordination: fleetOf([missing]),
        startupGraceMs: 0,
        failureThreshold: 1,
        timeoutMs: 500
      })
    ).rejects.toThrow(`1 active receiver(s) wedged: ${missing}`);

    await expect(
      checkConduitSelfHealth({ receiverId: missing, timeoutMs: 500 })
    ).rejects.toBeInstanceOf(ConduitHeartbeatError);
  });
});
