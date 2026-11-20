import { describe, expect, it } from 'vitest';
import { bootStep, runBoot, setBootFailureHandler } from './boot';

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

  it('hands the failure to the boot failure handler instead of rethrowing', async () => {
    let seen: { error: unknown; step: string }[] = [];
    setBootFailureHandler((error, step) => seen.push({ error, step }));

    try {
      let settled = false;
      runBoot([
        bootStep('a', () => {
          throw new Error('boom');
        })
      ]).then(() => (settled = true));
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(settled).toBe(false);
      expect(seen.map(item => item.step)).toEqual(['a']);
    } finally {
      setBootFailureHandler(null);
    }
  });
});
