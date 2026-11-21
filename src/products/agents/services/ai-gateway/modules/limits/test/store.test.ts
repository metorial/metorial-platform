import { describe, expect, it } from 'vitest';
import { createMemoryLimitStore } from '../src/lib/store';
import { createClock } from './fixtures';
import { storeContract } from './storeContract';

describe('memory limit store contract', () => {
  for (let testCase of storeContract) {
    it(testCase.name, async () => {
      await testCase.run(createMemoryLimitStore(), `t${crypto.randomUUID()}`);
    });
  }
});

describe('memory limit store', () => {
  it('expires counters and buckets against the injected clock', async () => {
    let clock = createClock(1_000);
    let store = createMemoryLimitStore({ now: clock.now });

    await store.increment([{ key: 'a', by: 2, expiresAt: 2_000 }]);
    await store.updateBucket({
      index: 'idx',
      key: 'idx:1',
      score: 1,
      updates: [{ op: 'increment', field: 'n', value: 1 }],
      expiresAt: 2_000,
      pruneBefore: 0
    });

    clock.set(1_999);
    expect(await store.read(['a'])).toEqual([2]);
    expect(await store.readBucket('idx:1')).toEqual({ n: 1 });

    clock.set(2_000);
    expect(await store.read(['a'])).toEqual([0]);
    expect(await store.readBucket('idx:1')).toEqual({});
    expect(await store.listBuckets({ index: 'idx', before: 10 })).toEqual([]);
  });

  it('extends a counter expiry on every increment', async () => {
    let clock = createClock(0);
    let store = createMemoryLimitStore({ now: clock.now });

    await store.increment([{ key: 'a', by: 1, expiresAt: 100 }]);
    await store.increment([{ key: 'a', by: 1, expiresAt: 200 }]);

    clock.set(150);
    expect(await store.read(['a'])).toEqual([2]);
  });
});
