import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../db', () => ({ db: {} }));
vi.mock('./eventQueues', () => ({
  slateTriggerWebhookPayloadCleanupQueue: {
    process: (handler: unknown) => ({ handler }),
    add: vi.fn()
  }
}));
vi.mock('@lowerdeck/cron', () => ({
  createCron: (_options: unknown, handler: unknown) => ({ handler })
}));

import { cleanupExpiredWebhookPayloads } from './webhookPayloadCleanup';

describe('webhook payload cleanup', () => {
  it('deletes only payloads at or before the expiry boundary', async () => {
    let before = new Date('2026-08-14T12:00:00.000Z');
    let findMany = vi.fn(async ({ where }: any) => {
      expect(where).toEqual({
        expiresAt: { lte: before },
        quarantinedAt: null,
        dispatchOutboxes: { none: {} }
      });
      return [{ oid: 1n }, { oid: 2n }];
    });
    let deleteMany = vi.fn(async ({ where }: any) => {
      expect(where).toEqual({
        oid: { in: [1n, 2n] },
        expiresAt: { lte: before },
        quarantinedAt: null,
        dispatchOutboxes: { none: {} }
      });
      return { count: 2 };
    });
    await expect(
      cleanupExpiredWebhookPayloads({
        store: { slateTriggerWebhookRequestPayload: { findMany, deleteMany } } as never,
        before,
        batchSize: 2
      })
    ).resolves.toEqual({ deleted: 2, remaining: true });
  });

  it('reports an empty abandoned/terminal cleanup batch without deleting', async () => {
    let deleteMany = vi.fn();
    await expect(
      cleanupExpiredWebhookPayloads({
        store: {
          slateTriggerWebhookRequestPayload: {
            findMany: vi.fn(async () => []),
            deleteMany
          }
        } as never,
        before: new Date(),
        batchSize: 500
      })
    ).resolves.toEqual({ deleted: 0, remaining: false });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('is registered in the trigger worker aggregator', async () => {
    let source = await readFile(new URL('./index.ts', import.meta.url), 'utf8');
    expect(source).toContain('slateTriggerWebhookPayloadCleanupCron');
    expect(source).toContain('slateTriggerWebhookPayloadCleanupQueueProcessor');
  });
});
