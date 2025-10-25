import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { cleanupCron } from '../src/cron/cleanup';
import { subDays, addDays } from 'date-fns';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    profileUpdate: {
      deleteMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((config, handler) => ({
    config,
    handler,
    name: config.name,
    cron: config.cron
  }))
}));

import { db } from '@metorial/db';

describe('cleanupCron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have correct cron configuration', () => {
    const cron = cleanupCron as any;
    expect(cron.config).toBeDefined();
    expect(cron.config.name).toBe('community/cleanup');
    expect(cron.config.cron).toBe('0 0 * * *'); // Daily at midnight
  });

  it('should delete profileUpdates older than 30 days', async () => {
    const now = new Date('2025-10-23T12:00:00Z');
    vi.setSystemTime(now);

    const expectedDate = subDays(now, 30);
    (db.profileUpdate.deleteMany as Mock).mockResolvedValue({ count: 5 });

    await (cleanupCron as any).handler();

    expect(db.profileUpdate.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: {
          lt: expectedDate
        }
      }
    });
  });

  it('should calculate correct date threshold', async () => {
    const now = new Date('2025-01-15T08:30:00Z');
    vi.setSystemTime(now);

    const expectedDate = subDays(now, 30); // Should be 2024-12-16T08:30:00Z
    (db.profileUpdate.deleteMany as Mock).mockResolvedValue({ count: 0 });

    await (cleanupCron as any).handler();

    const callArgs = (db.profileUpdate.deleteMany as Mock).mock.calls[0][0];
    expect(callArgs.where.createdAt.lt).toEqual(expectedDate);
  });

  it('should handle successful deletion of multiple records', async () => {
    const now = new Date('2025-10-23T00:00:00Z');
    vi.setSystemTime(now);

    (db.profileUpdate.deleteMany as Mock).mockResolvedValue({ count: 42 });

    await (cleanupCron as any).handler();

    expect(db.profileUpdate.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('should handle deletion when no records match', async () => {
    const now = new Date('2025-10-23T15:45:30Z');
    vi.setSystemTime(now);

    (db.profileUpdate.deleteMany as Mock).mockResolvedValue({ count: 0 });

    await (cleanupCron as any).handler();

    expect(db.profileUpdate.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('should use less than operator for date comparison', async () => {
    const now = new Date('2025-06-15T12:00:00Z');
    vi.setSystemTime(now);

    (db.profileUpdate.deleteMany as Mock).mockResolvedValue({ count: 1 });

    await (cleanupCron as any).handler();

    const callArgs = (db.profileUpdate.deleteMany as Mock).mock.calls[0][0];
    expect(callArgs.where.createdAt).toHaveProperty('lt');
    expect(callArgs.where.createdAt).not.toHaveProperty('lte');
    expect(callArgs.where.createdAt).not.toHaveProperty('gt');
    expect(callArgs.where.createdAt).not.toHaveProperty('gte');
  });

  it('should handle different times of day consistently', async () => {
    const midnight = new Date('2025-10-23T00:00:00Z');
    vi.setSystemTime(midnight);
    (db.profileUpdate.deleteMany as Mock).mockResolvedValue({ count: 1 });

    await (cleanupCron as any).handler();
    const midnightThreshold = (db.profileUpdate.deleteMany as Mock).mock.calls[0][0].where.createdAt.lt;

    vi.clearAllMocks();

    const noon = new Date('2025-10-23T12:00:00Z');
    vi.setSystemTime(noon);
    (db.profileUpdate.deleteMany as Mock).mockResolvedValue({ count: 1 });

    await (cleanupCron as any).handler();
    const noonThreshold = (db.profileUpdate.deleteMany as Mock).mock.calls[0][0].where.createdAt.lt;

    expect(midnightThreshold.getDate()).not.toBe(noonThreshold.getDate());
  });

  it('should handle leap year dates correctly', async () => {
    const now = new Date('2024-03-01T12:00:00Z'); // Day after leap day 2024
    vi.setSystemTime(now);

    (db.profileUpdate.deleteMany as Mock).mockResolvedValue({ count: 0 });

    await (cleanupCron as any).handler();

    const callArgs = (db.profileUpdate.deleteMany as Mock).mock.calls[0][0];
    const threshold = callArgs.where.createdAt.lt;

    // 30 days before March 1, 2024 should be January 31, 2024
    expect(threshold.getFullYear()).toBe(2024);
    expect(threshold.getMonth()).toBe(0); // January (0-indexed)
    expect(threshold.getDate()).toBe(31);
  });

  it('should handle year boundary correctly', async () => {
    const now = new Date('2025-01-15T12:00:00Z');
    vi.setSystemTime(now);

    (db.profileUpdate.deleteMany as Mock).mockResolvedValue({ count: 3 });

    await (cleanupCron as any).handler();

    const callArgs = (db.profileUpdate.deleteMany as Mock).mock.calls[0][0];
    const threshold = callArgs.where.createdAt.lt;

    // 30 days before Jan 15, 2025 should be Dec 16, 2024
    expect(threshold.getFullYear()).toBe(2024);
    expect(threshold.getMonth()).toBe(11); // December (0-indexed)
  });

  it('should handle database errors gracefully', async () => {
    const now = new Date('2025-10-23T12:00:00Z');
    vi.setSystemTime(now);

    const dbError = new Error('Database connection failed');
    (db.profileUpdate.deleteMany as Mock).mockRejectedValue(dbError);

    await expect((cleanupCron as any).handler()).rejects.toThrow('Database connection failed');
  });

  it('should not modify the current date when calculating threshold', async () => {
    const now = new Date('2025-10-23T12:00:00Z');
    const originalTime = now.getTime();
    vi.setSystemTime(now);

    (db.profileUpdate.deleteMany as Mock).mockResolvedValue({ count: 0 });

    await (cleanupCron as any).handler();

    expect(now.getTime()).toBe(originalTime);
  });

  it('should be idempotent when called multiple times', async () => {
    const now = new Date('2025-10-23T12:00:00Z');
    vi.setSystemTime(now);

    (db.profileUpdate.deleteMany as Mock).mockResolvedValue({ count: 5 });

    await (cleanupCron as any).handler();
    const firstCall = (db.profileUpdate.deleteMany as Mock).mock.calls[0][0];

    vi.clearAllMocks();
    (db.profileUpdate.deleteMany as Mock).mockResolvedValue({ count: 0 });

    await (cleanupCron as any).handler();
    const secondCall = (db.profileUpdate.deleteMany as Mock).mock.calls[0][0];

    expect(firstCall.where.createdAt.lt.getTime()).toBe(secondCall.where.createdAt.lt.getTime());
  });
});
