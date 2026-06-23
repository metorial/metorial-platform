import { describe, expect, it } from 'vitest';
import type { ConduitHeartbeatPong } from '@metorial-subspace/connection-utils';
import type { ConduitResponse } from '@metorial-subspace/conduit';
import {
  checkConduitHeartbeat,
  ConduitHeartbeatError,
  type ConduitHeartbeatSender
} from './conduitHeartbeat';
import { topics } from '../lib/topic';

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
});
