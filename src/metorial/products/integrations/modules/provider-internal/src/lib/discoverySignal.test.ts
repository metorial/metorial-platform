import { beforeEach, describe, expect, it, vi } from 'vitest';

let redis = vi.hoisted(() => {
  let values = new Map<string, string>();
  let listeners = new Map<string, (message: string) => void>();
  let state = { failConnect: false };

  let client = {
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    publish: vi.fn(async (channel: string, message: string) => {
      listeners.get(channel)?.(message);
    }),
    subscribe: vi.fn(async (channel: string, listener: (message: string) => void) => {
      listeners.set(channel, listener);
    })
  };

  let connect = async () => {
    if (state.failConnect) throw new Error('redis unavailable');
    return client;
  };

  return { values, listeners, state, client, connect };
});

vi.mock('@lowerdeck/redis', () => ({
  createRedisClient: () => ({ eager: redis.connect, lazy: () => redis.connect })
}));

vi.mock('../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

let loadSignal = async () => await import('./discoverySignal');

describe('discoverySignal', () => {
  beforeEach(() => {
    vi.resetModules();
    redis.values.clear();
    redis.listeners.clear();
    redis.state.failConnect = false;
    vi.clearAllMocks();
  });

  it('returns immediately when the completion marker is already set', async () => {
    let { markDiscoveryFinished, waitForDiscovery } = await loadSignal();
    await markDiscoveryFinished({ kind: 'pairVersion', oid: 1n, status: 'discovered' });

    let isFinished = vi.fn(async () => false);
    let startedAt = Date.now();
    await waitForDiscovery({ kind: 'pairVersion', oid: 1n, timeoutMs: 2_000, isFinished });

    expect(Date.now() - startedAt).toBeLessThan(500);
    expect(isFinished).not.toHaveBeenCalled();
  });

  it('resolves when completion is published while waiting', async () => {
    let { markDiscoveryFinished, waitForDiscovery } = await loadSignal();

    let startedAt = Date.now();
    let waiting = waitForDiscovery({
      kind: 'providerVersion',
      oid: 2n,
      timeoutMs: 2_000,
      isFinished: async () => false
    });

    await new Promise(resolve => setTimeout(resolve, 20));
    await markDiscoveryFinished({ kind: 'providerVersion', oid: 2n, status: 'discovered' });
    await waiting;

    expect(Date.now() - startedAt).toBeLessThan(500);
  });

  it('ignores completions for other records and gives up at the timeout', async () => {
    let { markDiscoveryFinished, waitForDiscovery } = await loadSignal();

    let startedAt = Date.now();
    let waiting = waitForDiscovery({
      kind: 'pairVersion',
      oid: 3n,
      timeoutMs: 150,
      isFinished: async () => false
    });
    await markDiscoveryFinished({ kind: 'pairVersion', oid: 4n, status: 'discovered' });
    await waiting;

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(140);
  });

  it('re-checks the marker when the completion message was missed', async () => {
    vi.useFakeTimers();

    try {
      let { waitForDiscovery, getDiscoveryMarkerKey } = await loadSignal();

      let resolved = false;
      let waiting = waitForDiscovery({
        kind: 'pairVersion',
        oid: 6n,
        timeoutMs: 60_000,
        isFinished: async () => false
      }).then(() => (resolved = true));

      await vi.advanceTimersByTimeAsync(1_000);
      redis.values.set(getDiscoveryMarkerKey('pairVersion', 6n), 'discovered');

      await vi.advanceTimersByTimeAsync(8_000);
      expect(resolved).toBe(false);

      await vi.advanceTimersByTimeAsync(1_000);
      await waiting;
      expect(resolved).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to polling the database when Redis is unavailable', async () => {
    redis.state.failConnect = true;
    let { waitForDiscovery } = await loadSignal();

    let isFinished = vi.fn(async () => true);
    await waitForDiscovery({ kind: 'pairVersion', oid: 5n, timeoutMs: 2_000, isFinished });

    expect(isFinished).toHaveBeenCalledTimes(1);
  });
});
