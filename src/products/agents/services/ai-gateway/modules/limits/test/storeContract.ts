import assert from 'node:assert/strict';
import { createLimitEventRecorder } from '../src/lib/events';
import { createGatewayLimiter } from '../src/lib/limiter';
import type { LimitStore } from '../src/lib/store';
import { principalWith, usageOf } from './fixtures';

// Shared by the memory store (vitest) and the Redis store (bun test against a real server), so
// both are held to the same semantics. Cases run on real time, so expiries are kept short.
export type StoreContractCase = {
  name: string;
  run: (store: LimitStore, ns: string) => Promise<void>;
};

let sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let farFuture = () => Date.now() + 60_000;

export let storeContract: StoreContractCase[] = [
  {
    name: 'reads missing counters as zero',
    run: async (store, ns) => {
      assert.deepEqual(await store.read([`${ns}:a`, `${ns}:b`]), [0, 0]);
      assert.deepEqual(await store.read([]), []);
    }
  },

  {
    name: 'increments counters and returns the new totals in order',
    run: async (store, ns) => {
      let expiresAt = farFuture();

      assert.deepEqual(
        await store.increment([
          { key: `${ns}:a`, by: 3, expiresAt },
          { key: `${ns}:b`, by: 1, expiresAt }
        ]),
        [3, 1]
      );
      assert.deepEqual(await store.increment([{ key: `${ns}:a`, by: 4, expiresAt }]), [7]);
      assert.deepEqual(await store.increment([{ key: `${ns}:a`, by: -2, expiresAt }]), [5]);
      assert.deepEqual(await store.read([`${ns}:b`, `${ns}:a`]), [1, 5]);
    }
  },

  {
    name: 'handles counters past 32 bits',
    run: async (store, ns) => {
      let expiresAt = farFuture();

      await store.increment([{ key: `${ns}:big`, by: 4_000_000_000, expiresAt }]);
      assert.deepEqual(
        await store.increment([{ key: `${ns}:big`, by: 4_000_000_000, expiresAt }]),
        [8_000_000_000]
      );
    }
  },

  {
    name: 'forgets counters once they expire',
    run: async (store, ns) => {
      await store.increment([{ key: `${ns}:short`, by: 5, expiresAt: Date.now() + 40 }]);
      assert.deepEqual(await store.read([`${ns}:short`]), [5]);

      await sleep(80);

      assert.deepEqual(await store.read([`${ns}:short`]), [0]);
      assert.deepEqual(
        await store.increment([{ key: `${ns}:short`, by: 1, expiresAt: farFuture() }]),
        [1]
      );
    }
  },

  {
    name: 'applies increment, set-if-absent and set updates to buckets',
    run: async (store, ns) => {
      let index = `${ns}:{idx}`;
      let key = `${index}:100`;
      let bucket = (updates: Parameters<LimitStore['updateBucket']>[0]['updates']) =>
        store.updateBucket({
          index,
          key,
          score: 100,
          updates,
          expiresAt: farFuture(),
          pruneBefore: 0
        });

      await bucket([
        { op: 'increment', field: 'count', value: 1 },
        { op: 'setIfAbsent', field: 'first', value: 10 },
        { op: 'set', field: 'last', value: 10 }
      ]);
      await bucket([
        { op: 'increment', field: 'count', value: 2 },
        { op: 'setIfAbsent', field: 'first', value: 20 },
        { op: 'set', field: 'last', value: 20 }
      ]);

      assert.deepEqual(await store.readBucket(key), { count: 3, first: 10, last: 20 });
      assert.deepEqual(await store.readBucket(`${index}:missing`), {});
    }
  },

  {
    name: 'lists buckets before a score in order and deletes them',
    run: async (store, ns) => {
      let index = `${ns}:{idx}`;

      for (let score of [300, 100, 200]) {
        await store.updateBucket({
          index,
          key: `${index}:${score}`,
          score,
          updates: [{ op: 'increment', field: 'n', value: score }],
          expiresAt: farFuture(),
          pruneBefore: 0
        });
      }

      assert.deepEqual(await store.listBuckets({ index, before: 300 }), [100, 200]);
      assert.deepEqual(await store.listBuckets({ index, before: 1000 }), [100, 200, 300]);

      await store.deleteBuckets({ index, buckets: [{ key: `${index}:100`, score: 100 }] });

      assert.deepEqual(await store.listBuckets({ index, before: 1000 }), [200, 300]);
      assert.deepEqual(await store.readBucket(`${index}:100`), {});
      assert.deepEqual(await store.readBucket(`${index}:200`), { n: 200 });

      await store.deleteBuckets({ index, buckets: [] });
    }
  },

  {
    name: 'prunes index entries older than the retention cutoff',
    run: async (store, ns) => {
      let index = `${ns}:{idx}`;
      let update = (score: number, pruneBefore: number) =>
        store.updateBucket({
          index,
          key: `${index}:${score}`,
          score,
          updates: [{ op: 'increment', field: 'n', value: 1 }],
          expiresAt: farFuture(),
          pruneBefore
        });

      await update(100, 0);
      await update(200, 0);
      await update(300, 150);

      assert.deepEqual(await store.listBuckets({ index, before: 1000 }), [200, 300]);
    }
  },

  {
    name: 'drains platform events recorded through the recorder',
    run: async (store, ns) => {
      let events = createLimitEventRecorder({ store, namespace: ns });

      await events.used({ projectId: 'gwpr_a', amounts: { requests: 1, tokens: 120 } });
      await events.used({
        projectId: 'gwpr_a',
        amounts: { requests: 1, tokens: 30, metorial_spend_usd: 250_000 }
      });
      await events.denied({ projectId: 'gwpr_a', metric: 'tokens' });
      await events.denied({ projectId: 'gwpr_a', metric: 'tokens' });

      let drained = await events.drain({
        tripsBefore: Number.MAX_SAFE_INTEGER,
        usageBefore: Number.MAX_SAFE_INTEGER
      });

      assert.equal(drained.trips.length, 1);
      assert.equal(drained.trips[0]!.entries.length, 1);
      assert.equal(drained.trips[0]!.entries[0]!.count, 2);
      assert.ok(
        drained.trips[0]!.entries[0]!.firstTrippedAt <=
          drained.trips[0]!.entries[0]!.lastTrippedAt
      );

      let usage = Object.fromEntries(
        drained.usage[0]!.entries.map(entry => [entry.metric, entry])
      );
      assert.deepEqual(usage.requests, {
        projectId: 'gwpr_a',
        metric: 'requests',
        used: 2,
        denied: 0
      });
      assert.deepEqual(usage.tokens, {
        projectId: 'gwpr_a',
        metric: 'tokens',
        used: 150,
        denied: 2
      });
      assert.equal(usage.metorial_spend_usd!.used, 0.25);

      await events.ack({
        tripBuckets: drained.trips.map(bucket => bucket.bucketStart),
        usageHours: drained.usage.map(hour => hour.hourStart)
      });

      assert.deepEqual(
        await events.drain({
          tripsBefore: Number.MAX_SAFE_INTEGER,
          usageBefore: Number.MAX_SAFE_INTEGER
        }),
        { trips: [], usage: [] }
      );
    }
  },

  {
    name: 'enforces request, token and spend limits end to end',
    run: async (store, ns) => {
      let limiter = createGatewayLimiter({
        store,
        events: createLimitEventRecorder({ store, namespace: ns })
      });
      let principal = principalWith({
        tokenId: `${ns}-token`,
        token: [
          { metric: 'requests', amount: 3, interval: '1d' },
          { metric: 'tokens', amount: 100, interval: '1d' },
          { metric: 'spend_usd', amount: 0.5, interval: '1d' }
        ]
      });
      let acquire = () =>
        limiter.acquire({ principal, dialect: 'openai_chat', estimateInputTokens: () => 5 });

      assert.equal((await acquire()).allowed, true);
      await limiter.settle({
        principal,
        usage: usageOf(40, 20),
        billedCostUsd: 0.1,
        metorialBilled: false
      });

      assert.equal((await acquire()).allowed, true);
      await limiter.settle({
        principal,
        usage: usageOf(30, 15),
        billedCostUsd: 0.45,
        metorialBilled: false
      });

      let denied = await acquire();
      assert.equal(denied.allowed, false);
      assert.equal(denied.allowed == false && denied.error.code, 'rate_limit_exceeded');
    }
  }
];
