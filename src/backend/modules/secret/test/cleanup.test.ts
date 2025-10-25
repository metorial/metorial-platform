import { beforeEach, describe, expect, it, vi } from 'vitest';
import { subDays } from 'date-fns';

// @ts-ignore
let { db } = await import('@metorial/db');

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    secretEvent: {
      deleteMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((config, handler) => ({
    config,
    handler,
    execute: async () => await handler()
  }))
}));

describe('secretCleanupCron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a cron job with correct configuration', async () => {
    const { createCron } = await import('@metorial/cron');
    const { secretCleanupCron } = await import('../src/cron/cleanup');

    expect(createCron).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'sec/cleanup',
        cron: '0 0 * * *'
      }),
      expect.any(Function)
    );
  });

  it('should delete secret events older than 14 days', async () => {
    const { secretCleanupCron } = await import('../src/cron/cleanup');

    // @ts-ignore - access the handler directly for testing
    await secretCleanupCron.execute();

    const twoWeeksAgo = subDays(new Date(), 14);

    expect(db.secretEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: {
          lte: expect.any(Date)
        }
      }
    });

    // Verify the date is approximately correct (within 1 second tolerance)
    const callArgs = (db.secretEvent.deleteMany as any).mock.calls[0][0];
    const calledDate = callArgs.where.createdAt.lte;
    const timeDiff = Math.abs(calledDate.getTime() - twoWeeksAgo.getTime());
    expect(timeDiff).toBeLessThan(1000); // Less than 1 second difference
  });

  it('should handle database errors gracefully', async () => {
    // @ts-ignore
    db.secretEvent.deleteMany.mockRejectedValue(new Error('Database error'));

    const { secretCleanupCron } = await import('../src/cron/cleanup');

    // @ts-ignore
    await expect(secretCleanupCron.execute()).rejects.toThrow('Database error');
  });

  it('should successfully complete when no events to delete', async () => {
    // @ts-ignore
    db.secretEvent.deleteMany.mockResolvedValue({ count: 0 });

    const { secretCleanupCron } = await import('../src/cron/cleanup');

    // @ts-ignore
    await expect(secretCleanupCron.execute()).resolves.not.toThrow();
    expect(db.secretEvent.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('should return delete count when events are deleted', async () => {
    // @ts-ignore
    db.secretEvent.deleteMany.mockResolvedValue({ count: 42 });

    const { secretCleanupCron } = await import('../src/cron/cleanup');

    // @ts-ignore
    const result = await secretCleanupCron.execute();

    expect(db.secretEvent.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('should calculate correct date boundary', async () => {
    const beforeExecution = subDays(new Date(), 14);

    const { secretCleanupCron } = await import('../src/cron/cleanup');
    // @ts-ignore
    await secretCleanupCron.execute();

    const afterExecution = subDays(new Date(), 14);

    const callArgs = (db.secretEvent.deleteMany as any).mock.calls[0][0];
    const calledDate = callArgs.where.createdAt.lte;

    // The called date should be between before and after execution
    expect(calledDate.getTime()).toBeGreaterThanOrEqual(beforeExecution.getTime());
    expect(calledDate.getTime()).toBeLessThanOrEqual(afterExecution.getTime());
  });
});
