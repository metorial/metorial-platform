import { describe, expect, it } from 'vitest';
import { bootStep, runBoot } from './boot';

describe('runBoot', () => {
  it('runs steps in order', async () => {
    let order: string[] = [];
    await runBoot([
      bootStep('a', async () => {
        await Promise.resolve();
        order.push('a');
      }),
      bootStep('b', () => {
        order.push('b');
      })
    ]);
    expect(order).toEqual(['a', 'b']);
  });

  it('stops at the first failing step and rethrows', async () => {
    let order: string[] = [];
    await expect(
      runBoot([
        bootStep('a', () => {
          throw new Error('boom');
        }),
        bootStep('b', () => {
          order.push('b');
        })
      ])
    ).rejects.toThrow('boom');
    expect(order).toEqual([]);
  });
});
