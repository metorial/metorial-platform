import type { Build } from '@aws-sdk/client-codebuild';
import { QueueRetryError } from '@lowerdeck/queue';
import { describe, expect, it, vi } from 'vitest';
import { createBuildLookup, isThrottlingError } from './buildLookup';

describe('createBuildLookup', () => {
  it('batches concurrent lookups into a single request', async () => {
    let fetchBuilds = vi.fn(async (ids: string[]) => ids.map(id => ({ id }) as Build));
    let lookup = createBuildLookup({ fetchBuilds, windowMs: 5 });

    let [a, b, a2] = await Promise.all([lookup('a'), lookup('b'), lookup('a')]);

    expect(fetchBuilds).toHaveBeenCalledTimes(1);
    expect(fetchBuilds).toHaveBeenCalledWith(['a', 'b']);
    expect(a?.id).toBe('a');
    expect(b?.id).toBe('b');
    expect(a2?.id).toBe('a');
  });

  it('resolves undefined for builds that were not returned', async () => {
    let lookup = createBuildLookup({ fetchBuilds: async () => [], windowMs: 5 });

    expect(await lookup('missing')).toBeUndefined();
  });

  it('splits requests above the AWS batch limit', async () => {
    let fetchBuilds = vi.fn(async (ids: string[]) => ids.map(id => ({ id }) as Build));
    let lookup = createBuildLookup({ fetchBuilds, windowMs: 5 });

    await Promise.all(Array.from({ length: 150 }, (_, i) => lookup(`build-${i}`)));

    expect(fetchBuilds).toHaveBeenCalledTimes(2);
    expect(fetchBuilds.mock.calls[0]![0]).toHaveLength(100);
    expect(fetchBuilds.mock.calls[1]![0]).toHaveLength(50);
  });

  it('turns throttling errors into queue retries', async () => {
    let lookup = createBuildLookup({
      fetchBuilds: async () => {
        throw Object.assign(new Error('Rate exceeded'), { name: 'ThrottlingException' });
      },
      windowMs: 5
    });

    await expect(lookup('a')).rejects.toBeInstanceOf(QueueRetryError);
  });

  it('passes other errors through', async () => {
    let lookup = createBuildLookup({
      fetchBuilds: async () => {
        throw new Error('boom');
      },
      windowMs: 5
    });

    await expect(lookup('a')).rejects.toThrow('boom');
  });
});

describe('isThrottlingError', () => {
  it('detects throttling by name or message', () => {
    expect(isThrottlingError({ name: 'ThrottlingException' })).toBe(true);
    expect(isThrottlingError(new Error('Rate exceeded: BatchGetBuilds'))).toBe(true);
    expect(isThrottlingError(new Error('nope'))).toBe(false);
  });
});
