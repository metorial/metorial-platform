import { describe, expect, test } from 'vitest';
import { createE2EVitestConfig, eventually, uniqueId } from './e2e';

describe('e2e helpers', () => {
  test('eventually retries until the callback passes', async () => {
    let attempts = 0;
    let result = await eventually(
      () => {
        attempts++;
        if (attempts < 3) throw new Error('not yet');
        return 'done';
      },
      { intervalMs: 1 }
    );

    expect(result).toBe('done');
    expect(attempts).toBe(3);
  });

  test('eventually rethrows the last error after the timeout', async () => {
    await expect(
      eventually(
        () => {
          throw new Error('still failing');
        },
        { timeoutMs: 20, intervalMs: 5 }
      )
    ).rejects.toThrow('still failing');
  });

  test('uniqueId is prefixed and collision free', () => {
    let ids = new Set(Array.from({ length: 100 }, () => uniqueId('store')));

    expect(ids.size).toBe(100);
    expect([...ids][0]).toMatch(/^store-/);
  });

  test('createE2EVitestConfig targets e2e files and merges overrides', () => {
    let config = createE2EVitestConfig({ test: { testTimeout: 5_000 } });

    expect(config.test?.include).toEqual(['e2e/**/*.e2e.ts']);
    expect(config.test?.passWithNoTests).toBe(false);
    expect(config.test?.hookTimeout).toBe(120_000);
    expect(config.test?.testTimeout).toBe(5_000);
  });
});
