import { subDays } from 'date-fns';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((config, handler) => handler)
}));

vi.mock('@metorial/db', () => ({
  db: {
    outgoingEmail: {
      deleteMany: vi.fn()
    }
  }
}));

vi.mock('date-fns', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    subDays: vi.fn()
  };
});

describe('cleanupCron', () => {
  let db: any;
  let cleanupCron: any;
  let mockSubDays: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup current date mock
    const mockDate = new Date('2025-01-15T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    db = (await import('@metorial/db')).db;
    mockSubDays = (await import('date-fns')).subDays;

    const cronModule = await import('../src/cron/cleanup');
    cleanupCron = cronModule.cleanupCron;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delete emails older than 30 days', async () => {
    const currentDate = new Date('2025-01-15T00:00:00.000Z');
    const thirtyDaysAgo = new Date('2024-12-16T00:00:00.000Z');

    mockSubDays.mockReturnValue(thirtyDaysAgo);
    db.outgoingEmail.deleteMany.mockResolvedValue({ count: 42 });

    await cleanupCron();

    expect(mockSubDays).toHaveBeenCalledWith(currentDate, 30);

    expect(db.outgoingEmail.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: {
          lt: thirtyDaysAgo
        }
      }
    });
  });

  it('should handle when no emails need deletion', async () => {
    const currentDate = new Date('2025-01-15T00:00:00.000Z');
    const thirtyDaysAgo = new Date('2024-12-16T00:00:00.000Z');

    mockSubDays.mockReturnValue(thirtyDaysAgo);
    db.outgoingEmail.deleteMany.mockResolvedValue({ count: 0 });

    await cleanupCron();

    expect(db.outgoingEmail.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: {
          lt: thirtyDaysAgo
        }
      }
    });
  });

  it('should handle database errors gracefully', async () => {
    const thirtyDaysAgo = new Date('2024-12-16T00:00:00.000Z');
    mockSubDays.mockReturnValue(thirtyDaysAgo);

    const dbError = new Error('Database connection lost');
    db.outgoingEmail.deleteMany.mockRejectedValue(dbError);

    await expect(cleanupCron()).rejects.toThrow('Database connection lost');
  });

  it('should delete large number of old emails', async () => {
    const thirtyDaysAgo = new Date('2024-12-16T00:00:00.000Z');
    mockSubDays.mockReturnValue(thirtyDaysAgo);

    db.outgoingEmail.deleteMany.mockResolvedValue({ count: 10000 });

    await cleanupCron();

    expect(db.outgoingEmail.deleteMany).toHaveBeenCalled();
  });

  it('should calculate correct date at different times of day', async () => {
    // Test at different time of day
    const currentDate = new Date('2025-01-15T23:59:59.999Z');
    vi.setSystemTime(currentDate);

    const thirtyDaysAgo = new Date('2024-12-16T23:59:59.999Z');
    mockSubDays.mockReturnValue(thirtyDaysAgo);

    db.outgoingEmail.deleteMany.mockResolvedValue({ count: 5 });

    await cleanupCron();

    expect(mockSubDays).toHaveBeenCalledWith(currentDate, 30);
  });

  it('should work correctly at month boundaries', async () => {
    // Test at month boundary
    const currentDate = new Date('2025-03-01T00:00:00.000Z');
    vi.setSystemTime(currentDate);

    const thirtyDaysAgo = new Date('2025-01-29T00:00:00.000Z');
    mockSubDays.mockReturnValue(thirtyDaysAgo);

    db.outgoingEmail.deleteMany.mockResolvedValue({ count: 15 });

    await cleanupCron();

    expect(mockSubDays).toHaveBeenCalledWith(currentDate, 30);
    expect(db.outgoingEmail.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: {
          lt: thirtyDaysAgo
        }
      }
    });
  });

  it('should work correctly at year boundaries', async () => {
    // Test at year boundary
    const currentDate = new Date('2025-01-10T00:00:00.000Z');
    vi.setSystemTime(currentDate);

    const thirtyDaysAgo = new Date('2024-12-11T00:00:00.000Z');
    mockSubDays.mockReturnValue(thirtyDaysAgo);

    db.outgoingEmail.deleteMany.mockResolvedValue({ count: 100 });

    await cleanupCron();

    expect(mockSubDays).toHaveBeenCalledWith(currentDate, 30);
    expect(db.outgoingEmail.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: {
          lt: thirtyDaysAgo
        }
      }
    });
  });
});
