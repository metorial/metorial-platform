import { describe, expect, it } from 'vitest';
import { submitEach } from './submit';
import type { PickerSelection } from './types';

let selections = (...keys: string[]): PickerSelection<null>[] =>
  keys.map(key => ({ item: { key, title: key, icon: () => null }, value: null }));

let tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe('submitEach', () => {
  it('reports the keys that returned false or threw', async () => {
    let result = await submitEach(selections('a', 'b', 'c', 'd'), async s => {
      if (s.item.key == 'b') return false;
      if (s.item.key == 'd') throw new Error('boom');
      return true;
    });

    expect(result.failed.sort()).toEqual(['b', 'd']);
  });

  it('runs one at a time by default', async () => {
    let running = 0;
    let peak = 0;

    await submitEach(selections('a', 'b', 'c'), async () => {
      running++;
      peak = Math.max(peak, running);
      await tick();
      running--;
      return true;
    });

    expect(peak).toBe(1);
  });

  it('respects the concurrency limit', async () => {
    let running = 0;
    let peak = 0;

    await submitEach(
      selections('a', 'b', 'c', 'd', 'e'),
      async () => {
        running++;
        peak = Math.max(peak, running);
        await tick();
        running--;
        return true;
      },
      { concurrency: 3 }
    );

    expect(peak).toBe(3);
  });

  it('handles an empty selection', async () => {
    expect(await submitEach(selections(), async () => true)).toEqual({ failed: [] });
  });
});
