import { describe, expect, it } from 'vitest';
import { waitForSettled } from '../../src/reconcile/service';

let clock = () => {
  let time = 0;

  return {
    now: () => time,
    sleep: async (ms: number) => {
      time += ms;
    }
  };
};

describe('waitForSettled', () => {
  it('reads stale summaries again until they settle', async () => {
    let reads = new Map<string, number>();
    let fetch = async (key: string) => {
      let count = (reads.get(key) ?? 0) + 1;
      reads.set(key, count);

      return { key, summaryStale: key == 'slow' && count < 3 };
    };

    let settled = await waitForSettled(['fast', 'slow'], fetch, {
      timeoutMs: 10_000,
      intervalMs: 1_000,
      ...clock()
    });

    expect([...settled.keys()].sort()).toEqual(['fast', 'slow']);
    expect(reads.get('fast')).toBe(1);
    expect(reads.get('slow')).toBe(3);
  });

  it('gives up on a summary that does not settle in time and leaves it out', async () => {
    let reads = 0;
    let fetch = async (key: string) => {
      reads++;
      return { key, summaryStale: true };
    };

    let settled = await waitForSettled(['stuck'], fetch, {
      timeoutMs: 5_000,
      intervalMs: 2_000,
      ...clock()
    });

    expect(settled.size).toBe(0);
    expect(reads).toBe(4);
  });
});
