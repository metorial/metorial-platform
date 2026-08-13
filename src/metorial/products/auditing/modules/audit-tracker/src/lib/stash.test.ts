import { serialize } from '@lowerdeck/serialize';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { redis } = vi.hoisted(() => ({
  redis: {
    rPush: vi.fn(),
    lRange: vi.fn(),
    eval: vi.fn(),
    lRem: vi.fn()
  }
}));

vi.mock('@metorial/redis', () => ({
  createRedisClient: vi.fn(() => ({
    lazy: () => async () => redis
  }))
}));

import {
  acknowledgeClaimedAuditEvent,
  claimAuditEvents,
  decodeStashedAuditEvent,
  listClaimedAuditEvents,
  stashAuditEvent
} from './stash';

describe('stashAuditEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redis.rPush.mockResolvedValue(1);
    redis.lRange.mockResolvedValue([]);
    redis.eval.mockResolvedValue([]);
    redis.lRem.mockResolvedValue(1);
  });

  it('appends a losslessly serialized event to the audit stash', async () => {
    let event = {
      id: 'event-1',
      organizationOid: 1n,
      instanceOid: 3n,
      organizationActorOid: 4n,
      actor: {
        type: 'org_actor' as const,
        id: 'oac_1'
      },
      context: {} as any,
      resource: 'organization',
      action: 'create',
      payload: {
        oid: 5n,
        createdAt: new Date('2026-08-12T10:00:00.000Z')
      },
      previousPayload: {
        oid: 4n,
        createdAt: new Date('2026-08-11T10:00:00.000Z')
      },
      recordedAt: new Date('2026-08-12T10:01:00.000Z')
    };

    await stashAuditEvent(event);

    expect(redis.rPush).toHaveBeenCalledOnce();
    expect(redis.rPush).toHaveBeenCalledWith('audit:events:stash', expect.any(String));

    let encoded = redis.rPush.mock.calls[0]![1];
    expect(serialize.decode(encoded)).toEqual(event);
  });

  it('propagates Redis append failures', async () => {
    redis.rPush.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(
      stashAuditEvent({
        id: 'event-1',
        organizationOid: 1n,
        instanceOid: 3n,
        organizationActorOid: 4n,
        actor: {
          type: 'system',
          id: 'test'
        },
        context: {} as any,
        resource: 'organization',
        action: 'create',
        payload: {},
        recordedAt: new Date()
      })
    ).rejects.toThrow('Redis unavailable');
  });

  it('decodes stashed events without actor metadata', () => {
    let event = {
      id: 'event-1',
      organizationOid: 1n,
      instanceOid: 3n,
      organizationActorOid: 4n
    };

    expect(decodeStashedAuditEvent(serialize.encode(event))).toEqual(event);
  });

  it('atomically claims a batch of the oldest pending events', async () => {
    redis.eval.mockResolvedValueOnce(['encoded-event-1', 'encoded-event-2']);

    await expect(claimAuditEvents(10)).resolves.toEqual([
      'encoded-event-1',
      'encoded-event-2'
    ]);
    expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining('LPOP'), {
      keys: ['audit:events:stash', 'audit:events:stash:claimed'],
      arguments: ['10']
    });
  });

  it('lists and acknowledges claimed events', async () => {
    redis.lRange.mockResolvedValueOnce(['encoded-event']);

    await expect(listClaimedAuditEvents()).resolves.toEqual(['encoded-event']);
    await acknowledgeClaimedAuditEvent('encoded-event');

    expect(redis.lRange).toHaveBeenCalledWith('audit:events:stash:claimed', 0, -1);
    expect(redis.lRem).toHaveBeenCalledWith('audit:events:stash:claimed', 1, 'encoded-event');
  });
});
