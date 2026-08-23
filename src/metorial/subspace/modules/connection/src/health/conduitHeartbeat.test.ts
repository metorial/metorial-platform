import { describe, expect, it, vi } from 'vitest';
import type { ConduitHeartbeatPong } from '@metorial-subspace/connection-utils';
import type { ConduitResponse } from '@metorial-subspace/conduit';

vi.mock('../lib/conduit', () => ({
  conduit: {
    createSender: vi.fn(),
    coordination: {
      getActiveReceivers: vi.fn(async () => [])
    }
  }
}));

import {
  checkConduitHeartbeat,
  checkConduitHeartbeatFleet,
  ConduitHeartbeatError,
  type ConduitHeartbeatSender
} from './conduitHeartbeat';
import { topics } from '../lib/topic';

let healthyPong = (receiverId: string): ConduitResponse => ({
  messageId: 'message-id',
  success: true,
  processedAt: 1,
  result: { type: 'conduit.health.pong', receiverId, at: 1 }
});

describe('checkConduitHeartbeat', () => {
  it('sends a health ping and returns the matching pong', async () => {
    let sentPayload: unknown;
    let sentTopic: string | undefined;
    let sentTimeout: number | undefined;

    let sender: ConduitHeartbeatSender = {
      send: async (topic, payload, timeout) => {
        sentTopic = topic;
        sentPayload = payload;
        sentTimeout = timeout;

        return {
          messageId: 'message-id',
          success: true,
          processedAt: 124,
          result: {
            type: 'health.pong',
            id: 'heartbeat-id',
            sentAt: 123,
            receivedAt: 124
          } satisfies ConduitHeartbeatPong
        } satisfies ConduitResponse;
      }
    };

    let result = await checkConduitHeartbeat({
      sender,
      id: 'heartbeat-id',
      now: () => 123,
      timeoutMs: 250
    });

    expect(sentTopic).toBe(topics.workerHeartbeat.encode());
    expect(sentTimeout).toBe(250);
    expect(sentPayload).toEqual({
      type: 'health.ping',
      id: 'heartbeat-id',
      sentAt: 123
    });
    expect(result).toEqual({
      type: 'health.pong',
      id: 'heartbeat-id',
      sentAt: 123,
      receivedAt: 124
    });
  });

  it('wraps failed conduit sends in ConduitHeartbeatError', async () => {
    let sender: ConduitHeartbeatSender = {
      send: async () => {
        throw new Error('No receiver available for topic v1-health-worker');
      }
    };

    await expect(checkConduitHeartbeat({ sender })).rejects.toBeInstanceOf(
      ConduitHeartbeatError
    );
    await expect(checkConduitHeartbeat({ sender })).rejects.toThrow('No receiver available');
  });

  it('rejects malformed worker pong responses', async () => {
    let sender: ConduitHeartbeatSender = {
      send: async () =>
        ({
          messageId: 'message-id',
          success: true,
          processedAt: 124,
          result: { type: 'health.pong', id: 'wrong-id', sentAt: 123, receivedAt: 124 }
        }) satisfies ConduitResponse
    };

    await expect(
      checkConduitHeartbeat({ sender, id: 'heartbeat-id', now: () => 123 })
    ).rejects.toBeInstanceOf(ConduitHeartbeatError);
  });

  it('tolerates an empty fleet when failOnEmptyFleet is false (no send, no churn)', async () => {
    let sent = false;
    let sender: ConduitHeartbeatSender = {
      send: async () => {
        sent = true;
        throw new Error('No receiver available for topic v1-health-worker');
      }
    };

    let result = await checkConduitHeartbeat({
      sender,
      failOnEmptyFleet: false,
      coordination: { getActiveReceivers: async () => [] }
    });

    expect(sent).toBe(false);
    expect(result).toEqual({ emptyFleet: true });
  });
});

describe('checkConduitHeartbeatFleet', () => {
  it('fails when the fleet is empty (total worker outage)', async () => {
    await expect(
      checkConduitHeartbeatFleet({
        coordination: { getActiveReceivers: async () => [] },
        pingReceiver: async () => healthyPong('unused'),
        startupGraceMs: 0
      })
    ).rejects.toBeInstanceOf(ConduitHeartbeatError);
  });

  it('tolerates an empty fleet when failOnEmptyFleet is false (no churn)', async () => {
    let result = await checkConduitHeartbeatFleet({
      coordination: { getActiveReceivers: async () => [] },
      pingReceiver: async () => healthyPong('unused'),
      startupGraceMs: 0,
      failOnEmptyFleet: false
    });

    expect(result).toEqual({ activeReceivers: 0, probed: 0, emptyFleet: true });
  });

  it('returns healthy when probed receivers pong', async () => {
    let id = `rx-healthy-${crypto.randomUUID()}`;
    let pinged: string[] = [];

    let result = await checkConduitHeartbeatFleet({
      coordination: { getActiveReceivers: async () => [id] },
      pingReceiver: async receiverId => {
        pinged.push(receiverId);
        return healthyPong(receiverId);
      },
      startupGraceMs: 0
    });

    expect(pinged).toEqual([id]);
    expect(result).toEqual({ activeReceivers: 1, probed: 1 });
  });

  it('does not count a failure toward wedged when the re-fetch also fails', async () => {
    let id = `rx-blip-${crypto.randomUUID()}`;
    let calls = 0;

    // First call (top of fn) succeeds; the re-fetch inside the catch throws.
    let coordination = {
      getActiveReceivers: async () => {
        calls++;
        if (calls === 1) return [id];
        throw new Error('redis blip');
      }
    };

    // failureThreshold 1 means: if the failure were counted, it would wedge and
    // throw. Indeterminate coordination must instead be skipped.
    let result = await checkConduitHeartbeatFleet({
      coordination,
      pingReceiver: async () => {
        throw new Error('ping failed');
      },
      startupGraceMs: 0,
      failureThreshold: 1
    });

    expect(result).toEqual({ activeReceivers: 1, probed: 1 });
  });

  it('wedges a receiver after failureThreshold consecutive confirmed failures', async () => {
    let id = `rx-wedge-${crypto.randomUUID()}`;
    let coordination = { getActiveReceivers: async () => [id] };
    let pingReceiver = async () => {
      throw new Error('ping failed');
    };
    let opts = { coordination, pingReceiver, startupGraceMs: 0, failureThreshold: 2 };

    // First failure: below threshold, still healthy.
    let first = await checkConduitHeartbeatFleet(opts);
    expect(first).toEqual({ activeReceivers: 1, probed: 1 });

    // Second consecutive failure reaches the threshold and wedges.
    await expect(checkConduitHeartbeatFleet(opts)).rejects.toBeInstanceOf(
      ConduitHeartbeatError
    );
  });

  it('discounts a receiver that has left the pool (not wedged)', async () => {
    let id = `rx-left-${crypto.randomUUID()}`;
    let calls = 0;
    let coordination = {
      getActiveReceivers: async () => {
        calls++;
        // Present at the top of the fn, gone on the re-fetch (graceful leave).
        return calls === 1 ? [id] : [];
      }
    };

    let result = await checkConduitHeartbeatFleet({
      coordination,
      pingReceiver: async () => {
        throw new Error('ping failed');
      },
      startupGraceMs: 0,
      failureThreshold: 1
    });

    expect(result).toEqual({ activeReceivers: 1, probed: 1 });
  });
});
