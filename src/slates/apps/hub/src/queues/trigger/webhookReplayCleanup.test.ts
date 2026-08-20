import { describe, expect, it, vi } from 'vitest';
import {
  cleanupExpiredWebhookReplayArtifacts,
  repairWebhookReplayScheduling
} from './webhookReplayCleanup';

describe('webhook replay retention cleanup', () => {
  it('deletes only terminal expired artifacts and keeps lease/reference guards', async () => {
    let before = new Date('2026-08-14T00:00:00.000Z');
    let store = {
      slateTriggerWebhookDispatchOutbox: {
        findMany: vi.fn(async () => [{ oid: 11n }]),
        deleteMany: vi.fn(async () => ({ count: 1 }))
      },
      slateTriggerWebhookReplayClaim: {
        findMany: vi.fn(async () => [{ oid: 21n }]),
        deleteMany: vi.fn(async () => ({ count: 1 }))
      }
    } as any;

    await expect(
      cleanupExpiredWebhookReplayArtifacts({ store, before, batchSize: 10 })
    ).resolves.toEqual({ deletedOutboxes: 1, deletedClaims: 1, remaining: false });
    expect(store.slateTriggerWebhookDispatchOutbox.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          retentionExpiresAt: { lte: before },
          status: { in: ['delivered', 'dead_letter'] },
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: before } }]
        })
      })
    );
    expect(store.slateTriggerWebhookReplayClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['responded', 'delivered', 'failed_terminal'] },
          dispatchOutbox: { is: null }
        })
      })
    );
  });

  it('repairs event-input and expired-lease crash gaps with stable job identities', async () => {
    let now = new Date('2026-08-14T00:00:00.000Z');
    let findMany = vi
      .fn()
      .mockResolvedValueOnce([{ eventInput: { id: 'input-a' } }])
      .mockResolvedValueOnce([{ id: 'outbox-a', attemptCount: 3 }]);
    let enqueueEventInputs = vi.fn(async () => {});
    let enqueueOutboxes = vi.fn(async () => {});
    let result = await repairWebhookReplayScheduling({
      store: { slateTriggerWebhookDispatchOutbox: { findMany } } as any,
      now,
      enqueueEventInputs: enqueueEventInputs as any,
      enqueueOutboxes: enqueueOutboxes as any
    });

    expect(result).toEqual({ eventInputs: 1, outboxes: 1 });
    expect(enqueueEventInputs).toHaveBeenCalledWith([
      { data: { eventInputId: 'input-a' }, opts: { id: 'input-a' } }
    ]);
    expect(enqueueOutboxes).toHaveBeenCalledWith([
      { data: { outboxId: 'outbox-a' }, opts: { id: 'outbox-a:3' } }
    ]);
    expect(findMany.mock.calls[1]?.[0]).toMatchObject({
      where: {
        readyAt: { not: null, lte: now },
        nextAttemptAt: { lte: now },
        OR: expect.arrayContaining([{ status: 'leased', leaseExpiresAt: { lte: now } }])
      }
    });
  });

  it('rejects unsafe cleanup batch bounds', async () => {
    await expect(
      cleanupExpiredWebhookReplayArtifacts({ store: {} as any, batchSize: 0 })
    ).rejects.toThrow('batch size');
  });
});
