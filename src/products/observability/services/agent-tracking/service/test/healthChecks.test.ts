import { describe, expect, it, vi } from 'vitest';
import { runHealthChecks, storeHealthCheck } from '../src/healthChecks';

describe('runHealthChecks', () => {
  it('is healthy when every check answers', async () => {
    let result = await runHealthChecks(
      [
        { name: 'postgres', run: async () => 1 },
        { name: 'redis', run: async () => 'PONG' }
      ],
      100
    );

    expect(result).toEqual({ healthy: true, failures: [] });
  });

  it('answers within the timeout when a dependency hangs, naming it', async () => {
    let startedAt = Date.now();

    let result = await runHealthChecks(
      [
        { name: 'postgres', run: async () => 1 },
        { name: 'redis', run: () => new Promise(() => {}) }
      ],
      50
    );

    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(result.healthy).toBe(false);
    expect(result.failures.map(failure => failure.name)).toEqual(['redis']);
  });

  it('runs the checks at the same time so the bound does not add up', async () => {
    let startedAt = Date.now();
    let hang = () => new Promise(() => {});

    let result = await runHealthChecks(
      [
        { name: 'postgres', run: hang },
        { name: 'redis', run: hang },
        { name: 'listener 52181', run: hang }
      ],
      100
    );

    expect(Date.now() - startedAt).toBeLessThan(250);
    expect(result.failures).toHaveLength(3);
  });

  it('reports a failing check', async () => {
    let result = await runHealthChecks(
      [{ name: 'listener 52180', run: async () => Promise.reject(new Error('503')) }],
      100
    );

    expect(result.healthy).toBe(false);
    expect(result.failures[0]).toMatchObject({ name: 'listener 52180' });
  });
});

describe('storeHealthCheck', () => {
  let store = (d: { connected: boolean; ready: () => Promise<unknown> }) => ({
    hasConnected: () => d.connected,
    ready: vi.fn(d.ready)
  });
  let hanging = () => new Promise(() => {});
  let refused = () => Promise.reject(new Error('refused'));

  it('passes once the store has connected, even while it is down', async () => {
    let connected = store({ connected: true, ready: refused });

    let result = await runHealthChecks(
      [storeHealthCheck({ store: connected, startedAt: 0, graceMs: 1000, now: () => 60_000 })],
      50
    );

    expect(result.healthy).toBe(true);
    expect(connected.ready).not.toHaveBeenCalled();
  });

  it('tries to connect but passes during the grace period', async () => {
    let starting = store({ connected: false, ready: refused });

    let result = await runHealthChecks(
      [storeHealthCheck({ store: starting, startedAt: 0, graceMs: 1000, now: () => 500 })],
      50
    );

    expect(result.healthy).toBe(true);
    expect(starting.ready).toHaveBeenCalledTimes(1);
  });

  it('fails a task that has never reached its store after the grace period', async () => {
    let failing = await runHealthChecks(
      [
        storeHealthCheck({
          store: store({ connected: false, ready: refused }),
          startedAt: 0,
          graceMs: 1000,
          now: () => 5000
        })
      ],
      50
    );
    let hangingStore = await runHealthChecks(
      [
        storeHealthCheck({
          store: store({ connected: false, ready: hanging }),
          startedAt: 0,
          graceMs: 1000,
          now: () => 5000
        })
      ],
      50
    );
    let reached = await runHealthChecks(
      [
        storeHealthCheck({
          store: store({ connected: false, ready: async () => {} }),
          startedAt: 0,
          graceMs: 1000,
          now: () => 5000
        })
      ],
      50
    );

    expect(failing.failures.map(failure => failure.name)).toEqual(['record store']);
    expect(hangingStore.healthy).toBe(false);
    expect(reached.healthy).toBe(true);
  });
});
