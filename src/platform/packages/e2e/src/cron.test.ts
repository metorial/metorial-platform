import { describe, expect, test } from 'bun:test';
import { eventuallyWithCron } from './cron';

let countingCron = () => {
  let cron = { triggers: 0, trigger: async () => void cron.triggers++ };
  return cron;
};

describe('eventuallyWithCron', () => {
  test('leaves the cron alone when the first attempt passes', async () => {
    let cron = countingCron();

    expect(await eventuallyWithCron(cron, () => 'done')).toBe('done');
    expect(cron.triggers).toBe(0);
  });

  test('triggers every cron after each failed attempt until the check passes', async () => {
    let crons = [countingCron(), countingCron()];
    let attempts = 0;

    let result = await eventuallyWithCron(
      crons,
      () => {
        if (++attempts < 3) throw new Error('not yet');
        return attempts;
      },
      { intervalMs: 1 }
    );

    expect(result).toBe(3);
    expect(crons.map(cron => cron.triggers)).toEqual([2, 2]);
  });

  test('keeps polling when a trigger fails and rethrows the check error on timeout', async () => {
    let failing = {
      trigger: async () => {
        throw new Error('redis unreachable');
      }
    };
    let attempts = 0;

    expect(
      await eventuallyWithCron(
        failing,
        () => {
          if (++attempts < 2) throw new Error('not yet');
          return 'done';
        },
        { intervalMs: 1 }
      )
    ).toBe('done');

    await expect(
      eventuallyWithCron(
        failing,
        () => {
          throw new Error('never');
        },
        { timeoutMs: 5, intervalMs: 1 }
      )
    ).rejects.toThrow('never');
  });
});
