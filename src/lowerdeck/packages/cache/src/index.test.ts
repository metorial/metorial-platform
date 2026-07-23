import { describe, expect, it, vi } from 'vitest';
import { createLocallyCachedFunction } from './index';

describe('createLocallyCachedFunction', () => {
  it('cleans up rejected requests without creating an unhandled rejection', async () => {
    let expectedError = new Error('Expected provider failure');
    let provider = vi.fn(async () => {
      throw expectedError;
    });
    let cached = createLocallyCachedFunction({
      getHash: (key: string) => key,
      provider,
      ttlSeconds: 60
    });
    let unhandledRejections: unknown[] = [];
    let onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason);
    };

    process.on('unhandledRejection', onUnhandledRejection);
    try {
      await expect(cached('key')).rejects.toBe(expectedError);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(unhandledRejections).toEqual([]);

      await expect(cached('key')).rejects.toBe(expectedError);
      expect(provider).toHaveBeenCalledTimes(2);
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }
  });
});
