import { describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/cron', () => ({ createCron: vi.fn(() => ({})) }));
vi.mock('@lowerdeck/queue', () => ({
  createQueue: vi.fn(() => ({ add: vi.fn(), process: vi.fn(() => ({})) }))
}));
vi.mock('../../db', () => ({ db: {} }));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://test' } } }));
vi.mock('./delivery', () => ({ attemptDeliveryQueue: { add: vi.fn() } }));
vi.mock('./init', () => ({ newEventQueue: { add: vi.fn() } }));

import { repairEventDeliveryRetries, repairEventInitialization } from './repair';

describe('Signal queue boundary repair', () => {
  it('re-enqueues unfinished event initialization with the stable Event job ID', async () => {
    let enqueue = vi.fn(async () => {});
    let updateMany = vi.fn(async () => ({ count: 1 }));
    let store = {
      event: {
        findMany: vi.fn(async () => [{ id: 'evt_1' }, { id: 'evt_2' }]),
        updateMany
      }
    } as any;

    await expect(
      repairEventInitialization({ store, enqueue: enqueue as any, batchSize: 10 })
    ).resolves.toEqual({ repaired: 2, remaining: false });
    expect(enqueue).toHaveBeenNthCalledWith(1, { eventId: 'evt_1' }, { id: 'evt_1' });
    expect(enqueue).toHaveBeenNthCalledWith(2, { eventId: 'evt_2' }, { id: 'evt_2' });
    expect(updateMany).toHaveBeenCalledTimes(2);
  });

  it('repairs both a missing retry job and a persisted-but-unapplied attempt', async () => {
    let enqueue = vi.fn(async () => {});
    let store = {
      eventDeliveryIntent: {
        findMany: vi.fn(async () => [
          { id: 'edi_retry', attemptCount: 1, attempts: [{ attemptNumber: 1 }] },
          { id: 'edi_persisted', attemptCount: 1, attempts: [{ attemptNumber: 2 }] }
        ])
      }
    } as any;

    await expect(
      repairEventDeliveryRetries({ store, enqueue, batchSize: 10 })
    ).resolves.toEqual({ repaired: 2, remaining: false });
    expect(enqueue).toHaveBeenNthCalledWith(
      1,
      { intentId: 'edi_retry' },
      { id: 'edi_retry:attempt:2' }
    );
    expect(enqueue).toHaveBeenNthCalledWith(
      2,
      { intentId: 'edi_persisted' },
      { id: 'edi_persisted:attempt:2' }
    );
  });
});
