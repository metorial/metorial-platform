import { describe, expect, it, vi } from 'vitest';

vi.mock('./init', () => ({ newEventQueue: { add: vi.fn() } }));
import { repairEventInitialization } from './repair';

describe('Signal event initialization repair', () => {
  it('scans only persisted idempotent incomplete events and reuses stable event job IDs', async () => {
    let before = new Date('2026-08-14T00:00:00.000Z');
    let updateMany = vi.fn(async () => ({ count: 1 }));
    let store = {
      event: {
        findMany: vi.fn(async () => [{ id: 'event-a' }, { id: 'event-b' }]),
        updateMany
      }
    } as any;
    let enqueue = vi.fn(async () => {});

    await expect(
      repairEventInitialization({ store, before, batchSize: 10, enqueue: enqueue as any })
    ).resolves.toEqual({ repaired: 2, remaining: false });
    expect(store.event.findMany).toHaveBeenCalledWith({
      where: {
        idempotencyKey: { not: null },
        initializationStatus: { not: 'initialized' },
        createdAt: { lte: before }
      },
      orderBy: { oid: 'asc' },
      take: 10,
      select: { id: true }
    });
    expect(enqueue).toHaveBeenNthCalledWith(1, { eventId: 'event-a' }, { id: 'event-a' });
    expect(enqueue).toHaveBeenNthCalledWith(2, { eventId: 'event-b' }, { id: 'event-b' });
    expect(updateMany).toHaveBeenCalledTimes(2);
  });

  it('reports another bounded pass when the batch is full', async () => {
    let store = {
      event: {
        findMany: vi.fn(async () => [{ id: 'event-a' }]),
        updateMany: vi.fn(async () => ({ count: 1 }))
      }
    } as any;
    await expect(
      repairEventInitialization({
        store,
        batchSize: 1,
        enqueue: vi.fn(async () => {}) as any
      })
    ).resolves.toEqual({ repaired: 1, remaining: true });
  });
});
