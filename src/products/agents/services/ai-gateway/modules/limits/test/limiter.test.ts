import type { LimitDecision } from '@mtsrc/ai-gateway-module-inference';
import { describe, expect, it, vi } from 'vitest';
import { createLimitEventRecorder } from '../src/lib/events';
import { createGatewayLimiter } from '../src/lib/limiter';
import { createMemoryLimitStore, type LimitStore } from '../src/lib/store';
import { createClock, noon, principalWith, setupLimiter } from './fixtures';

let expectAllowed = (decision: LimitDecision) => {
  if (!decision.allowed)
    throw new Error(`Expected an allowed request, got ${decision.error.code}`);
  return decision;
};

let expectDenied = (decision: LimitDecision) => {
  if (decision.allowed) throw new Error('Expected a denied request');
  return decision;
};

let countingStore = () => {
  let store = createMemoryLimitStore();
  let calls = { read: 0, increment: 0 };

  let wrapped: LimitStore = {
    ...store,
    read: async keys => {
      calls.read++;
      return await store.read(keys);
    },
    increment: async increments => {
      calls.increment++;
      return await store.increment(increments);
    }
  };

  return { store: wrapped, calls };
};

describe('without limits', () => {
  it('allows everything without touching the store', async () => {
    let { store, calls } = countingStore();
    let { acquire, settle } = setupLimiter({ store });
    let estimate = vi.fn(() => 10);

    let decision = expectAllowed(await acquire(principalWith(), { estimate }));
    await settle(principalWith(), { input: 100, output: 100, costUsd: 1 });

    expect(decision).toEqual({ allowed: true, headers: {} });
    expect(calls).toEqual({ read: 0, increment: 0 });
    expect(estimate).not.toHaveBeenCalled();
  });
});

describe('request limits', () => {
  let principal = principalWith({
    token: [{ metric: 'requests', amount: 3, interval: '1m' }]
  });

  it('allows the limit and denies the next request with headers and retry-after', async () => {
    let { acquire, clock } = setupLimiter();
    clock.advance(20_000);

    let remaining: string[] = [];
    for (let i = 0; i < 3; i++) {
      let decision = expectAllowed(await acquire(principal));
      remaining.push(decision.headers['x-ratelimit-remaining-requests']!);
    }

    let denied = expectDenied(await acquire(principal));

    expect(remaining).toEqual(['2', '1', '0']);
    expect(denied.error).toMatchObject({ status: 429, code: 'rate_limit_exceeded' });
    expect(denied.headers).toMatchObject({
      'retry-after': '40',
      'x-ratelimit-limit-requests': '3',
      'x-ratelimit-remaining-requests': '0',
      'x-ratelimit-reset-requests': '40s'
    });
  });

  it('does not count denied requests', async () => {
    let { acquire, store } = setupLimiter();

    for (let i = 0; i < 3; i++) await acquire(principal);
    for (let i = 0; i < 5; i++) expectDenied(await acquire(principal));

    let [rule] = await store.read([`aigw:lim:c:token:gwtk_1:requests:1m:${noon}`]);
    expect(rule).toBe(3);
  });

  it('starts over in the next window', async () => {
    let { acquire, clock } = setupLimiter();

    for (let i = 0; i < 3; i++) await acquire(principal);
    expectDenied(await acquire(principal));

    clock.advance(60_000);

    let decision = expectAllowed(await acquire(principal));
    expect(decision.headers['x-ratelimit-remaining-requests']).toBe('2');
  });

  it('counts tokens and instances separately but shares the instance limit across tokens', async () => {
    let { acquire } = setupLimiter();
    let tokenA = principalWith({
      tokenId: 'gwtk_a',
      token: [{ metric: 'requests', amount: 10, interval: '1m' }],
      instance: [{ metric: 'requests', amount: 3, interval: '1m' }]
    });
    let tokenB = principalWith({
      tokenId: 'gwtk_b',
      token: [{ metric: 'requests', amount: 10, interval: '1m' }],
      instance: [{ metric: 'requests', amount: 3, interval: '1m' }]
    });

    expectAllowed(await acquire(tokenA));
    expectAllowed(await acquire(tokenB));
    expectAllowed(await acquire(tokenA));

    let denied = expectDenied(await acquire(tokenB));
    expect(denied.error.message).toContain('This gateway instance is limited to 3 requests');
  });

  it('gives back every counter it took when one scope denies', async () => {
    let { acquire, store } = setupLimiter();
    let both = principalWith({
      token: [{ metric: 'requests', amount: 1, interval: '1m' }],
      instance: [{ metric: 'requests', amount: 100, interval: '1m' }]
    });

    expectAllowed(await acquire(both));
    for (let i = 0; i < 4; i++) expectDenied(await acquire(both));

    let [instance] = await store.read([`aigw:lim:c:instance:gwin_1:requests:1m:${noon}`]);
    expect(instance).toBe(1);
  });

  it('enforces every window of a token at once', async () => {
    let { acquire, clock } = setupLimiter();
    let layered = principalWith({
      token: [
        { metric: 'requests', amount: 2, interval: '1m' },
        { metric: 'requests', amount: 3, interval: '1h' }
      ]
    });

    expectAllowed(await acquire(layered));
    expectAllowed(await acquire(layered));
    expect(expectDenied(await acquire(layered)).error.message).toContain('per minute');

    clock.advance(60_000);
    expectAllowed(await acquire(layered));

    let denied = expectDenied(await acquire(layered));
    expect(denied.error.message).toContain('3 requests per hour');
    expect(denied.headers['retry-after']).toBe(String(60 * 60 - 60));
  });

  it('lets exactly the limit through under concurrency', async () => {
    let { acquire } = setupLimiter();
    let limited = principalWith({
      token: [{ metric: 'requests', amount: 5, interval: '1m' }]
    });

    let decisions = await Promise.all(Array.from({ length: 20 }, () => acquire(limited)));

    expect(decisions.filter(decision => decision.allowed)).toHaveLength(5);
  });
});

describe('token limits', () => {
  let principal = principalWith({
    token: [{ metric: 'tokens', amount: 1000, interval: '1m' }]
  });

  it('charges input and output tokens when a request settles', async () => {
    let { acquire, settle } = setupLimiter();

    expectAllowed(await acquire(principal, { estimate: 100 }));
    await settle(principal, { input: 300, output: 200 });

    let decision = expectAllowed(await acquire(principal, { estimate: 100 }));
    expect(decision.headers['x-ratelimit-remaining-tokens']).toBe('500');
  });

  it('denies once used tokens reach the limit', async () => {
    let { acquire, settle } = setupLimiter();

    await settle(principal, { input: 600, output: 400 });

    let denied = expectDenied(await acquire(principal, { estimate: 0 }));
    expect(denied.error.code).toBe('rate_limit_exceeded');
    expect(denied.headers).toMatchObject({
      'x-ratelimit-remaining-tokens': '0',
      'retry-after': '60'
    });
  });

  it('denies a request whose estimate does not fit the remaining tokens', async () => {
    let { acquire, settle } = setupLimiter();

    await settle(principal, { input: 900 });

    expectAllowed(await acquire(principal, { estimate: 100 }));
    expectDenied(await acquire(principal, { estimate: 101 }));
  });

  it('rejects a request that could never fit without a retry-after', async () => {
    let { acquire } = setupLimiter();

    let denied = expectDenied(await acquire(principal, { estimate: 1001 }));

    expect(denied.error.message).toContain('needs about 1001 input tokens');
    expect(denied.headers['retry-after']).toBeUndefined();
  });

  it('lets usage overshoot within a window, as streamed output cannot be stopped mid-way', async () => {
    let { acquire, settle } = setupLimiter();

    expectAllowed(await acquire(principal, { estimate: 10 }));
    await settle(principal, { input: 10, output: 5000 });

    let denied = expectDenied(await acquire(principal, { estimate: 1 }));
    expect(denied.headers['x-ratelimit-remaining-tokens']).toBe('0');
  });

  it('only estimates input tokens when a token limit applies', async () => {
    let { acquire } = setupLimiter();
    let estimate = vi.fn(() => 10);

    await acquire(
      principalWith({ token: [{ metric: 'requests', amount: 5, interval: '1m' }] }),
      {
        estimate
      }
    );
    expect(estimate).not.toHaveBeenCalled();

    await acquire(principal, { estimate });
    expect(estimate).toHaveBeenCalledTimes(1);
  });

  it('does not take a request slot when tokens deny', async () => {
    let { acquire, settle, store } = setupLimiter();
    let both = principalWith({
      token: [
        { metric: 'requests', amount: 10, interval: '1m' },
        { metric: 'tokens', amount: 100, interval: '1m' }
      ]
    });

    await settle(both, { input: 100 });
    expectDenied(await acquire(both));

    let [requests] = await store.read([`aigw:lim:c:token:gwtk_1:requests:1m:${noon}`]);
    expect(requests).toBe(0);
  });

  it('ignores negative estimates', async () => {
    let { acquire } = setupLimiter();
    expectAllowed(await acquire(principal, { estimate: -50 }));
  });
});

describe('spend limits', () => {
  let principal = principalWith({
    instance: [{ metric: 'spend_usd', amount: 1, interval: '1mo' }]
  });

  it('charges billed cost and denies once the spend limit is reached', async () => {
    let { acquire, settle } = setupLimiter();

    await settle(principal, { costUsd: 0.6 });
    expectAllowed(await acquire(principal));

    await settle(principal, { costUsd: 0.4 });
    let denied = expectDenied(await acquire(principal));

    expect(denied.error).toMatchObject({ status: 429, code: 'spend_limit_exceeded' });
  });

  it('counts customer-billed and Metorial-billed traffic alike', async () => {
    let { acquire, settle } = setupLimiter();

    await settle(principal, { costUsd: 0.5, metorialBilled: false });
    await settle(principal, { costUsd: 0.5, metorialBilled: true });

    expectDenied(await acquire(principal));
  });

  it('keeps sub-cent costs exact', async () => {
    let { acquire, settle } = setupLimiter();
    let tiny = principalWith({
      token: [{ metric: 'spend_usd', amount: 0.001, interval: '1d' }]
    });

    for (let i = 0; i < 9; i++) await settle(tiny, { costUsd: 0.0001 });
    expectAllowed(await acquire(tiny));

    await settle(tiny, { costUsd: 0.0001 });
    expectDenied(await acquire(tiny));
  });

  it('resets monthly spend on the first of the next month', async () => {
    let { acquire, settle, clock } = setupLimiter({ start: Date.UTC(2026, 10, 30, 23, 59) });

    await settle(principal, { costUsd: 1 });
    let denied = expectDenied(await acquire(principal));
    expect(denied.headers['retry-after']).toBe('60');

    clock.set(Date.UTC(2026, 11, 1));
    expectAllowed(await acquire(principal));
  });

  it('sends no rate limit headers for spend', async () => {
    let { acquire } = setupLimiter();
    expect(expectAllowed(await acquire(principal)).headers).toEqual({});
  });
});

describe('headers', () => {
  it('reports the tightest limit across scopes in the Anthropic format', async () => {
    let { acquire } = setupLimiter();
    let principal = principalWith({
      token: [{ metric: 'requests', amount: 100, interval: '1m' }],
      instance: [{ metric: 'requests', amount: 2, interval: '1h' }],
      platform: [{ metric: 'tokens', amount: 50_000, intervalSeconds: 86_400 }]
    });

    let decision = expectAllowed(await acquire(principal, { dialect: 'anthropic_messages' }));

    expect(decision.headers).toEqual({
      'anthropic-ratelimit-requests-limit': '2',
      'anthropic-ratelimit-requests-remaining': '1',
      'anthropic-ratelimit-requests-reset': '2026-11-20T13:00:00Z',
      'anthropic-ratelimit-tokens-limit': '50000',
      'anthropic-ratelimit-tokens-remaining': '50000',
      'anthropic-ratelimit-tokens-reset': '2026-11-21T00:00:00Z'
    });
  });
});

describe('platform limits', () => {
  it('applies plan request and token limits to all traffic', async () => {
    let { acquire, settle } = setupLimiter();
    let principal = principalWith({
      platform: [
        { metric: 'requests', amount: 2, intervalSeconds: 60 },
        { metric: 'tokens', amount: 100, intervalSeconds: 86_400 }
      ]
    });

    expectAllowed(await acquire(principal));
    await settle(principal, { input: 60, metorialBilled: false });
    expectAllowed(await acquire(principal));

    let denied = expectDenied(await acquire(principal));
    expect(denied.error).toMatchObject({ status: 429, code: 'plan_limit_exceeded' });
  });

  it('denies a zero allowance outright', async () => {
    let { acquire } = setupLimiter();
    let blocked = principalWith({
      platform: [{ metric: 'requests', amount: 0, intervalSeconds: 60 }]
    });

    expect(expectDenied(await acquire(blocked)).error.code).toBe('plan_limit_exceeded');
  });

  it('records usage and denials for the rate limit system', async () => {
    let { acquire, settle, drain, clock } = setupLimiter();
    let principal = principalWith({
      platform: [
        { metric: 'requests', amount: 2, intervalSeconds: 3600 },
        { metric: 'metorial_spend_usd', amount: 10, intervalSeconds: 86_400 }
      ]
    });

    await acquire(principal);
    await settle(principal, { input: 100, output: 50, costUsd: 0.25, metorialBilled: true });
    await acquire(principal);
    await settle(principal, { input: 10, output: 5, costUsd: 0.5, metorialBilled: false });

    clock.advance(1000);
    await acquire(principal);
    await acquire(principal);

    let drained = await drain();

    expect(drained.trips).toEqual([
      {
        bucketStart: noon,
        entries: [
          {
            projectId: 'gwpr_1',
            metric: 'requests',
            count: 2,
            firstTrippedAt: noon + 1000,
            lastTrippedAt: noon + 1000
          }
        ]
      }
    ]);
    expect(drained.usage).toHaveLength(1);
    expect(drained.usage[0]!.hourStart).toBe(noon);
    expect(drained.usage[0]!.entries).toEqual(
      expect.arrayContaining([
        { projectId: 'gwpr_1', metric: 'requests', used: 2, denied: 2 },
        { projectId: 'gwpr_1', metric: 'tokens', used: 165, denied: 0 },
        { projectId: 'gwpr_1', metric: 'metorial_spend_usd', used: 0.25, denied: 0 }
      ])
    );
  });

  it('records no platform events for projects without platform limits', async () => {
    let { acquire, settle, drain } = setupLimiter();
    let principal = principalWith({
      token: [{ metric: 'requests', amount: 1, interval: '1m' }]
    });

    await acquire(principal);
    await settle(principal, { input: 10, output: 10, costUsd: 1, metorialBilled: true });
    await acquire(principal);

    expect(await drain()).toEqual({ trips: [], usage: [] });
  });

  it('keeps serving when platform events cannot be recorded', async () => {
    let store = createMemoryLimitStore();
    let events = createLimitEventRecorder({ store });
    let limiter = createGatewayLimiter({
      store,
      events: {
        ...events,
        used: async () => {
          throw new Error('redis is down');
        },
        denied: async () => {
          throw new Error('redis is down');
        }
      }
    });
    let error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let principal = principalWith({
      platform: [{ metric: 'requests', amount: 1, intervalSeconds: 60 }]
    });
    let acquire = () =>
      limiter.acquire({ principal, dialect: 'openai_chat', estimateInputTokens: () => 1 });

    expect((await acquire()).allowed).toBe(true);
    expect((await acquire()).allowed).toBe(false);
    expect(error).toHaveBeenCalled();

    error.mockRestore();
  });
});

describe('Metorial-billed allowance', () => {
  let principal = principalWith({
    platform: [{ metric: 'metorial_spend_usd', amount: 1, intervalSeconds: 86_400 }]
  });

  it('only counts Metorial-billed spend', async () => {
    let { acquire, settle } = setupLimiter();

    await settle(principal, { costUsd: 5, metorialBilled: false });
    expect(expectAllowed(await acquire(principal)).metorialBillingLimit).toBeUndefined();

    await settle(principal, { costUsd: 1, metorialBilled: true });
    expect(expectAllowed(await acquire(principal)).metorialBillingLimit).toBeDefined();
  });

  it('allows the request but restricts it to customer billing once used up', async () => {
    let { acquire, settle, drain } = setupLimiter();

    await settle(principal, { costUsd: 1.5, metorialBilled: true });
    let decision = expectAllowed(await acquire(principal));

    expect(decision.metorialBillingLimit!.error).toMatchObject({
      status: 429,
      code: 'plan_limit_exceeded',
      message: expect.stringContaining('Connect your own provider keys')
    });
    expect((await drain()).trips).toEqual([]);

    decision.metorialBillingLimit!.onEnforced();
    await vi.waitFor(async () => expect((await drain()).trips).toHaveLength(1));

    let usage = (await drain()).usage[0]!.entries.find(
      entry => entry.metric == 'metorial_spend_usd'
    );
    expect(usage).toEqual({
      projectId: 'gwpr_1',
      metric: 'metorial_spend_usd',
      used: 1.5,
      denied: 1
    });
  });

  it('still enforces the other limits first', async () => {
    let { acquire, settle } = setupLimiter();
    let both = principalWith({
      platform: [
        { metric: 'metorial_spend_usd', amount: 1, intervalSeconds: 86_400 },
        { metric: 'tokens', amount: 10, intervalSeconds: 86_400 }
      ]
    });

    await settle(both, { input: 10, costUsd: 2, metorialBilled: true });

    expect(expectDenied(await acquire(both)).error.message).toContain('10 tokens per day');
  });
});

describe('settle', () => {
  it('charges the window it settles in', async () => {
    let { acquire, settle, clock } = setupLimiter({ start: noon + 59_000 });
    let principal = principalWith({
      token: [{ metric: 'tokens', amount: 100, interval: '1m' }]
    });

    expectAllowed(await acquire(principal, { estimate: 10 }));
    clock.advance(2000);
    await settle(principal, { input: 100 });

    expectDenied(await acquire(principal, { estimate: 1 }));
    clock.set(noon);
    expectAllowed(await acquire(principal, { estimate: 1 }));
  });

  it('skips the store when nothing was used', async () => {
    let { store, calls } = countingStore();
    let { settle } = setupLimiter({ store });
    let principal = principalWith({
      token: [{ metric: 'tokens', amount: 100, interval: '1m' }]
    });

    await settle(principal, { input: 0, output: 0, costUsd: 0 });

    expect(calls.increment).toBe(0);
  });

  it('lets counters expire shortly after their window', async () => {
    let clock = createClock();
    let store = createMemoryLimitStore({ now: clock.now });
    let limiter = createGatewayLimiter({ store, now: clock.now });
    let principal = principalWith({
      token: [{ metric: 'tokens', amount: 100, interval: '1m' }]
    });
    let key = `aigw:lim:c:token:gwtk_1:tokens:1m:${noon}`;

    await limiter.settle({
      principal,
      usage: {
        input: { total: 5, noCache: 5, cacheRead: 0, cacheWrite: 0 },
        output: { total: 0, text: 0, reasoning: 0 }
      },
      billedCostUsd: 0,
      metorialBilled: false
    });

    clock.set(noon + 60_000 + 59_999);
    expect(await store.read([key])).toEqual([5]);

    clock.set(noon + 120_000);
    expect(await store.read([key])).toEqual([0]);
  });
});
