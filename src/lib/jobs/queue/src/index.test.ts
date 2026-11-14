import { describe, expect, it, vi } from 'vitest';
import { combineQueueProcessors } from './index';
import type { IQueueProcessor } from './types';

let deferred = () => {
  let resolve!: () => void;
  let promise = new Promise<void>(res => {
    resolve = res;
  });

  return { promise, resolve };
};

describe('combineQueueProcessors', () => {
  it('waits for each processor before starting the next one', async () => {
    let firstStarted = deferred();
    let starts: string[] = [];
    let processor = (name: string, wait?: Promise<void>): IQueueProcessor => ({
      start: async () => {
        starts.push(name);
        await wait;
      }
    });

    let starting = combineQueueProcessors([
      processor('first', firstStarted.promise),
      processor('second')
    ]).start();

    await vi.waitFor(() => expect(starts).toEqual(['first']));
    firstStarted.resolve();
    await starting;

    expect(starts).toEqual(['first', 'second']);
  });

  it('closes processors that started before a later processor fails', async () => {
    let closeFirst = vi.fn();
    let closeSecond = vi.fn();
    let failure = new Error('failed to start');

    let combined = combineQueueProcessors([
      { start: async () => ({ close: closeFirst }) },
      { start: async () => ({ close: closeSecond }) },
      {
        start: async () => {
          throw failure;
        }
      }
    ]);

    await expect(combined.start()).rejects.toBe(failure);
    expect(closeSecond).toHaveBeenCalledOnce();
    expect(closeFirst).toHaveBeenCalledOnce();
  });
});
