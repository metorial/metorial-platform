import { describe, expect, test } from 'vitest';
import { RetryManager } from '../../src/core/retryManager';

describe('RetryManager', () => {
  test('should succeed on first attempt', async () => {
    const manager = new RetryManager(3, 100, 2);
    let attempts = 0;

    const result = await manager.withRetry(async () => {
      attempts++;
      return 'success';
    }, 'Test operation');

    expect(result).toBe('success');
    expect(attempts).toBe(1);
  });

  test('should retry on failure and eventually succeed', async () => {
    const manager = new RetryManager(3, 10, 2);
    let attempts = 0;

    const result = await manager.withRetry(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error(`Attempt ${attempts} failed`);
      }
      return 'success';
    }, 'Test operation');

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  test('should throw after max retries exceeded', async () => {
    const manager = new RetryManager(2, 10, 2);
    let attempts = 0;

    await expect(
      manager.withRetry(async () => {
        attempts++;
        throw new Error('Always fails');
      }, 'Test operation')
    ).rejects.toThrow('Test operation failed after 3 attempts: Always fails');

    expect(attempts).toBe(3); // Initial + 2 retries
  });

  test('should apply exponential backoff', async () => {
    const manager = new RetryManager(3, 100, 2);
    const timestamps: number[] = [];

    try {
      await manager.withRetry(async attemptNum => {
        timestamps.push(Date.now());
        throw new Error('Fail');
      }, 'Test operation');
    } catch {
      // Expected to fail
    }

    // Check intervals between attempts
    expect(timestamps.length).toBe(4); // 0 retries + 3 retries

    const interval1 = timestamps[1]! - timestamps[0]!;
    const interval2 = timestamps[2]! - timestamps[1]!;
    const interval3 = timestamps[3]! - timestamps[2]!;

    // First retry: ~100ms
    expect(interval1).toBeGreaterThanOrEqual(95);
    expect(interval1).toBeLessThan(150);

    // Second retry: ~200ms (100 * 2)
    expect(interval2).toBeGreaterThanOrEqual(195);
    expect(interval2).toBeLessThan(250);

    // Third retry: ~400ms (100 * 2^2)
    expect(interval3).toBeGreaterThanOrEqual(395);
    expect(interval3).toBeLessThan(450);
  });

  test('should calculate correct backoff values', () => {
    const manager = new RetryManager(5, 100, 2);

    expect(manager.calculateBackoff(0)).toBe(100); // 100 * 2^0
    expect(manager.calculateBackoff(1)).toBe(200); // 100 * 2^1
    expect(manager.calculateBackoff(2)).toBe(400); // 100 * 2^2
    expect(manager.calculateBackoff(3)).toBe(800); // 100 * 2^3
    expect(manager.calculateBackoff(4)).toBe(1600); // 100 * 2^4
  });

  test('should handle non-Error exceptions', async () => {
    const manager = new RetryManager(1, 10, 2);

    await expect(
      manager.withRetry(async () => {
        throw 'String error';
      }, 'Test operation')
    ).rejects.toThrow('Test operation failed after 2 attempts: String error');
  });

  test('should pass attempt number to function', async () => {
    const manager = new RetryManager(3, 10, 2);
    const attemptNumbers: number[] = [];

    try {
      await manager.withRetry(async attemptNum => {
        attemptNumbers.push(attemptNum);
        throw new Error('Fail');
      }, 'Test operation');
    } catch {
      // Expected
    }

    expect(attemptNumbers).toEqual([0, 1, 2, 3]);
  });

  test('should work with zero retries', async () => {
    const manager = new RetryManager(0, 100, 2);
    let attempts = 0;

    await expect(
      manager.withRetry(async () => {
        attempts++;
        throw new Error('Fail');
      }, 'Test operation')
    ).rejects.toThrow();

    expect(attempts).toBe(1); // Only initial attempt, no retries
  });

  test('should handle async operations correctly', async () => {
    const manager = new RetryManager(2, 10, 2);
    let attempts = 0;

    const result = await manager.withRetry(async () => {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 50));
      if (attempts < 2) {
        throw new Error('Fail');
      }
      return 'async success';
    }, 'Async operation');

    expect(result).toBe('async success');
    expect(attempts).toBe(2);
  });

  test('should handle very large backoff multipliers', () => {
    const manager = new RetryManager(5, 10, 10);

    expect(manager.calculateBackoff(0)).toBe(10);
    expect(manager.calculateBackoff(1)).toBe(100);
    expect(manager.calculateBackoff(2)).toBe(1000);
    expect(manager.calculateBackoff(3)).toBe(10000);
  });

  test('should handle fractional backoff multipliers', () => {
    const manager = new RetryManager(3, 100, 1.5);

    expect(manager.calculateBackoff(0)).toBe(100); // 100 * 1.5^0
    expect(manager.calculateBackoff(1)).toBe(150); // 100 * 1.5^1
    expect(manager.calculateBackoff(2)).toBe(225); // 100 * 1.5^2
  });

  test('should preserve original error message', async () => {
    const manager = new RetryManager(1, 10, 2);
    const originalError = new Error('Specific error message');

    try {
      await manager.withRetry(async () => {
        throw originalError;
      }, 'Test operation');
    } catch (err) {
      expect((err as Error).message).toContain('Specific error message');
    }
  });

  test('should handle concurrent retries', async () => {
    const manager = new RetryManager(2, 10, 2);

    const results = await Promise.all([
      manager.withRetry(async attemptNum => {
        if (attemptNum === 0) throw new Error('Fail');
        return 'result1';
      }, 'Op1'),
      manager.withRetry(async attemptNum => {
        if (attemptNum === 0) throw new Error('Fail');
        return 'result2';
      }, 'Op2'),
      manager.withRetry(async attemptNum => {
        if (attemptNum === 0) throw new Error('Fail');
        return 'result3';
      }, 'Op3')
    ]);

    expect(results).toEqual(['result1', 'result2', 'result3']);
  });
});
