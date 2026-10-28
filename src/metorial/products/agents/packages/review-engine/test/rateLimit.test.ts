import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acquireReviewModel,
  createMemoryRateLimiter,
  createReviewModels,
  type ReviewModel
} from '../src';

let model = (slug: string, extra: Partial<ReviewModel> = {}): ReviewModel => ({
  slug,
  model: slug,
  pricing: {
    inputPerMillion: 1,
    outputPerMillion: 1,
    cacheReadPerMillion: 1,
    cacheWritePerMillion: 0
  },
  ...extra
});

describe('memory rate limiter', () => {
  it('spaces reservations by the interval', async () => {
    let time = 1000;
    let limiter = createMemoryRateLimiter(() => time);
    let reserve = () => limiter.reserve({ key: 'a', intervalMs: 3000, maxWaitMs: 60_000 });

    expect(await reserve()).toBe(0);
    expect(await reserve()).toBe(3000);
    expect(await reserve()).toBe(6000);

    time += 6000;
    expect(await reserve()).toBe(3000);
  });

  it('keeps keys independent', async () => {
    let limiter = createMemoryRateLimiter(() => 0);

    expect(await limiter.reserve({ key: 'a', intervalMs: 3000, maxWaitMs: 0 })).toBe(0);
    expect(await limiter.reserve({ key: 'b', intervalMs: 3000, maxWaitMs: 0 })).toBe(0);
  });

  it('refuses without reserving when the wait is too long', async () => {
    let limiter = createMemoryRateLimiter(() => 0);

    expect(await limiter.reserve({ key: 'a', intervalMs: 3000, maxWaitMs: 2000 })).toBe(0);
    expect(await limiter.reserve({ key: 'a', intervalMs: 3000, maxWaitMs: 2000 })).toBeNull();
    expect(await limiter.reserve({ key: 'a', intervalMs: 3000, maxWaitMs: 3000 })).toBe(3000);
  });
});

describe('acquireReviewModel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns unlimited models immediately', async () => {
    let limiter = createMemoryRateLimiter();
    let reserve = vi.spyOn(limiter, 'reserve');
    let unlimited = model('open');

    expect(
      await acquireReviewModel({ model: unlimited, access: { limiter, maxWaitMs: 1000 } })
    ).toBe(unlimited);
    expect(reserve).not.toHaveBeenCalled();
  });

  it('waits for a slot within the timeout', async () => {
    let limiter = createMemoryRateLimiter();
    let primary = model('primary', { requestsPerMinute: 20, fallback: model('fallback') });
    let access = { limiter, maxWaitMs: 10_000 };

    expect(await acquireReviewModel({ model: primary, access })).toBe(primary);

    let second = acquireReviewModel({ model: primary, access });
    let settled = vi.fn();
    second.then(settled);

    await vi.advanceTimersByTimeAsync(2999);
    expect(settled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(await second).toBe(primary);
  });

  it('switches to the fallback once the wait exceeds the timeout', async () => {
    let limiter = createMemoryRateLimiter();
    let fallback = model('fallback');
    let primary = model('primary', { requestsPerMinute: 20, fallback });
    let access = { limiter, maxWaitMs: 4000 };
    let onFallback = vi.fn();

    await limiter.reserve({ key: 'primary', intervalMs: 3000, maxWaitMs: 0 });
    await limiter.reserve({ key: 'primary', intervalMs: 3000, maxWaitMs: 10_000 });

    // Two slots are already reserved, so the next one is 6s out.
    expect(await acquireReviewModel({ model: primary, access, onFallback })).toBe(fallback);
    expect(onFallback).toHaveBeenCalledWith({ from: primary, to: fallback });
  });

  it('makes the last model in the chain wait however long it takes', async () => {
    let limiter = createMemoryRateLimiter();
    let last = model('last', { requestsPerMinute: 60 });
    let access = { limiter, maxWaitMs: 100 };

    await acquireReviewModel({ model: last, access });

    let second = acquireReviewModel({ model: last, access });
    let settled = vi.fn();
    second.then(settled);

    await vi.advanceTimersByTimeAsync(999);
    expect(settled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(await second).toBe(last);
  });

  it('stops waiting when aborted', async () => {
    let limiter = createMemoryRateLimiter();
    let primary = model('primary', { requestsPerMinute: 20, fallback: model('fallback') });
    let access = { limiter, maxWaitMs: 60_000 };
    let controller = new AbortController();

    await acquireReviewModel({ model: primary, access });
    let waiting = acquireReviewModel({ model: primary, access, signal: controller.signal });
    let rejected = expect(waiting).rejects.toThrow('stopped');

    controller.abort(new Error('stopped'));
    await rejected;
  });
});

describe('cloudflare fallback chain', () => {
  it('limits DeepSeek and falls back to unlimited Nemotron', () => {
    let models = createReviewModels({ cloudflare: { accountId: 'acct', apiToken: 't' } })!;

    expect(models.balanced.requestsPerMinute).toBeLessThan(20);
    expect(models.balanced.slug).toBe('deepseek-v4-1-flash');
    expect(models.balanced.fallback?.slug).toBe('nemotron-3-120b');
    expect(models.balanced.fallback?.requestsPerMinute).toBeUndefined();
    expect(models.fast.slug).toBe(models.balanced.slug);
    expect(models.fast.fallback?.slug).toBe('nemotron-3-120b');
  });

  it('does not limit Vercel models', () => {
    let models = createReviewModels({ vercel: { apiKey: 'k' } })!;

    expect(models.balanced.requestsPerMinute).toBeUndefined();
    expect(models.balanced.fallback).toBeUndefined();
  });
});
