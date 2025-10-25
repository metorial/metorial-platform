// @ts-nocheck - Test file with mocked types
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { subDays } from 'date-fns';

// Mock external dependencies
vi.mock('@metorial/db', () => ({
  db: {
    scmRepoWebhookReceivedEvent: {
      deleteMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((config, handler) => ({
    config,
    handler
  }))
}));

import { db } from '@metorial/db';
import { cleanupCron } from '../src/cron/cleanup';

describe('cleanup cron job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have correct cron configuration', () => {
    expect((cleanupCron as any).config).toEqual({
      name: 'scm/cleanup',
      cron: '0 0 * * *' // Daily at midnight
    });
  });

  it('should delete webhook events older than 7 days', async () => {
    const now = new Date('2024-01-15T00:00:00Z');
    vi.setSystemTime(now);

    vi.mocked(db.scmRepoWebhookReceivedEvent.deleteMany).mockResolvedValue({ count: 10 } as any);

    await (cleanupCron as any).handler();

    const oneWeekAgo = subDays(now, 7);

    expect(db.scmRepoWebhookReceivedEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: {
          lt: oneWeekAgo
        }
      }
    });
  });

  it('should handle deletion when no old events exist', async () => {
    const now = new Date('2024-01-15T00:00:00Z');
    vi.setSystemTime(now);

    vi.mocked(db.scmRepoWebhookReceivedEvent.deleteMany).mockResolvedValue({ count: 0 } as any);

    await (cleanupCron as any).handler();

    expect(db.scmRepoWebhookReceivedEvent.deleteMany).toHaveBeenCalled();
  });

  it('should calculate correct date threshold', async () => {
    const now = new Date('2024-02-29T12:30:45Z'); // Leap year
    vi.setSystemTime(now);

    vi.mocked(db.scmRepoWebhookReceivedEvent.deleteMany).mockResolvedValue({ count: 5 } as any);

    await (cleanupCron as any).handler();

    const oneWeekAgo = subDays(now, 7);
    expect(oneWeekAgo.toISOString()).toBe('2024-02-22T12:30:45.000Z');

    expect(db.scmRepoWebhookReceivedEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: {
          lt: oneWeekAgo
        }
      }
    });
  });

  it('should handle database errors gracefully', async () => {
    const now = new Date('2024-01-15T00:00:00Z');
    vi.setSystemTime(now);

    vi.mocked(db.scmRepoWebhookReceivedEvent.deleteMany).mockRejectedValue(
      new Error('Database connection error')
    );

    await expect((cleanupCron as any).handler()).rejects.toThrow('Database connection error');
  });

  it('should delete events from different time zones correctly', async () => {
    // Set time to midnight UTC
    const now = new Date('2024-06-15T00:00:00Z');
    vi.setSystemTime(now);

    vi.mocked(db.scmRepoWebhookReceivedEvent.deleteMany).mockResolvedValue({ count: 15 } as any);

    await (cleanupCron as any).handler();

    // One week ago should be June 8th at midnight UTC
    const oneWeekAgo = subDays(now, 7);
    expect(oneWeekAgo.toISOString()).toBe('2024-06-08T00:00:00.000Z');

    expect(db.scmRepoWebhookReceivedEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: {
          lt: oneWeekAgo
        }
      }
    });
  });

  it('should run daily at midnight according to cron schedule', () => {
    // Verify cron schedule is set to run daily at midnight
    expect((cleanupCron as any).config.cron).toBe('0 0 * * *');
  });

  it('should delete only old events and preserve recent ones', async () => {
    const now = new Date('2024-03-01T00:00:00Z');
    vi.setSystemTime(now);

    vi.mocked(db.scmRepoWebhookReceivedEvent.deleteMany).mockResolvedValue({ count: 42 } as any);

    await (cleanupCron as any).handler();

    // Events created after 2024-02-23 should be preserved
    const oneWeekAgo = subDays(now, 7);

    expect(db.scmRepoWebhookReceivedEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: {
          lt: oneWeekAgo // Only delete events before this date
        }
      }
    });
  });

  it('should handle large number of deletions', async () => {
    const now = new Date('2024-01-15T00:00:00Z');
    vi.setSystemTime(now);

    // Simulate deleting a large number of old events
    vi.mocked(db.scmRepoWebhookReceivedEvent.deleteMany).mockResolvedValue({
      count: 100000
    } as any);

    await (cleanupCron as any).handler();

    expect(db.scmRepoWebhookReceivedEvent.deleteMany).toHaveBeenCalled();
  });

  it('should use correct date calculation across month boundaries', async () => {
    // Test at the end of January
    const now = new Date('2024-01-31T00:00:00Z');
    vi.setSystemTime(now);

    vi.mocked(db.scmRepoWebhookReceivedEvent.deleteMany).mockResolvedValue({ count: 3 } as any);

    await (cleanupCron as any).handler();

    const oneWeekAgo = subDays(now, 7);
    // Should be January 24th
    expect(oneWeekAgo.toISOString()).toBe('2024-01-24T00:00:00.000Z');
  });

  it('should have handler function defined', () => {
    expect((cleanupCron as any).handler).toBeDefined();
    expect(typeof (cleanupCron as any).handler).toBe('function');
  });
});
