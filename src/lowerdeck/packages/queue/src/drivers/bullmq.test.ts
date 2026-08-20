import { beforeEach, describe, expect, it, vi } from 'vitest';
import SuperJson from 'superjson';

let mocks = vi.hoisted(() => ({
  queueConstructed: vi.fn(),
  queueAdd: vi.fn(),
  workerConstructed: vi.fn(),
  workerProcessor: undefined as undefined | ((job: any) => Promise<void>),
  workerWaitUntilReady: vi.fn(),
  workerRun: vi.fn(),
  workerClose: vi.fn()
}));

vi.mock('bullmq', () => ({
  Queue: class Queue {
    constructor() {
      mocks.queueConstructed();
    }

    add = mocks.queueAdd;
    addBulk = vi.fn();
  },
  QueueEvents: class QueueEvents {},
  Worker: class Worker {
    constructor(_name: string, processor: (job: any) => Promise<void>) {
      mocks.workerConstructed();
      mocks.workerProcessor = processor;
    }

    waitUntilReady = mocks.workerWaitUntilReady;
    run = mocks.workerRun;
    close = mocks.workerClose;
  }
}));

import { createBullMqQueue, isQueueAttemptExhausted } from './bullmq';

describe('queue terminal attempt calculation', () => {
  it('does not exhaust attempt 24 of 25 and exhausts attempt 25', () => {
    expect(isQueueAttemptExhausted(24, 25)).toBe(false);
    expect(isQueueAttemptExhausted(25, 25)).toBe(true);
  });
});

describe('createBullMqQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queueAdd.mockResolvedValue({});
    mocks.workerWaitUntilReady.mockResolvedValue(undefined);
    mocks.workerRun.mockResolvedValue(undefined);
    mocks.workerClose.mockResolvedValue(undefined);
    mocks.workerProcessor = undefined;
  });

  it('does not create a producer connection until the queue publishes', async () => {
    let queue = createBullMqQueue({
      name: 'lazy-producer',
      redisUrl: 'redis://localhost:6379'
    });

    expect(mocks.queueConstructed).not.toHaveBeenCalled();
    await queue.add({ value: true });
    expect(mocks.queueConstructed).toHaveBeenCalledOnce();
  });

  it('waits for the worker connection before reporting the processor as started', async () => {
    let resolveReady: () => void = () => {};
    let ready = new Promise<void>(resolve => {
      resolveReady = resolve;
    });
    mocks.workerWaitUntilReady.mockReturnValue(ready);

    let processor = createBullMqQueue({
      name: 'ready-worker',
      redisUrl: 'redis://localhost:6379'
    }).process(async () => {});
    let starting = processor.start();

    await vi.waitFor(() => expect(mocks.workerConstructed).toHaveBeenCalledOnce());
    expect(mocks.workerRun).not.toHaveBeenCalled();

    resolveReady();
    await starting;
    expect(mocks.workerRun).toHaveBeenCalledOnce();
  });

  it('calls the terminal hook only for the exhausted real worker attempt', async () => {
    let onFinalFailure = vi.fn(async () => {});
    let processor = createBullMqQueue<{ id: string }>({
      name: 'terminal-hook',
      redisUrl: 'redis://localhost:6379'
    }).process(
      async () => {
        throw new Error('terminal');
      },
      { onFinalFailure }
    );
    await processor.start();
    let invoke = (attemptsMade: number) =>
      mocks.workerProcessor!({
        id: 'job-1',
        data: { payload: SuperJson.serialize({ id: 'payload-1' }) },
        attemptsMade,
        opts: { attempts: 25 }
      });

    await expect(invoke(23)).rejects.toThrow('terminal');
    expect(onFinalFailure).not.toHaveBeenCalled();
    await expect(invoke(24)).rejects.toThrow('terminal');
    expect(onFinalFailure).toHaveBeenCalledOnce();
    expect(onFinalFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { id: 'payload-1' },
        attemptNumber: 25,
        maxAttempts: 25
      })
    );
  });

  it('surfaces an exhausted terminal-hook failure instead of swallowing it', async () => {
    let processor = createBullMqQueue<{ id: string }>({
      name: 'terminal-hook-failure',
      redisUrl: 'redis://localhost:6379'
    }).process(
      async () => {
        throw new Error('original failure');
      },
      {
        onFinalFailure: async () => {
          throw new Error('terminal repair persistence failed');
        }
      }
    );
    await processor.start();
    await expect(
      mocks.workerProcessor!({
        id: 'job-2',
        data: { payload: SuperJson.serialize({ id: 'payload-2' }) },
        attemptsMade: 24,
        opts: { attempts: 25 }
      })
    ).rejects.toThrow('terminal repair persistence failed');
  });
});
