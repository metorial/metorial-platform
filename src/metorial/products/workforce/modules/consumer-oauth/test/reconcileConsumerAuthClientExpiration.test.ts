import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addMonths } from 'date-fns';

let reconcileConsumerAuthClientExpirationHandler: (() => Promise<void>) | undefined;

vi.mock('@metorial/db', () => ({
  db: {
    consumerAuthClient: {
      updateMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((_, handler) => {
    reconcileConsumerAuthClientExpirationHandler = handler;
    return { handler };
  })
}));

let { db } = await import('@metorial/db');
let { reconcileConsumerAuthClientExpirationCron } = await import(
  '../src/cron/reconcileConsumerAuthClientExpiration'
);

describe('reconcile consumer auth client expiration cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extends every unexpired client by three months', async () => {
    vi.useFakeTimers();
    let now = new Date('2026-01-15T00:00:00.000Z');
    vi.setSystemTime(now);

    expect(reconcileConsumerAuthClientExpirationCron).toBeDefined();
    await reconcileConsumerAuthClientExpirationHandler!();

    expect(db.consumerAuthClient.updateMany).toHaveBeenCalledWith({
      where: {
        expiresAt: { gt: now }
      },
      data: {
        expiresAt: addMonths(now, 3)
      }
    });
    vi.useRealTimers();
  });
});
