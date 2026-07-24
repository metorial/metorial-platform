import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  queueConstructed: vi.fn(),
  queueAdd: vi.fn(),
  workerConstructed: vi.fn(),
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
    constructor() {
      mocks.workerConstructed();
    }

    waitUntilReady = mocks.workerWaitUntilReady;
    run = mocks.workerRun;
    close = mocks.workerClose;
  }
}));

import { createBullMqQueue } from './bullmq';

describe('createBullMqQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queueAdd.mockResolvedValue({});
    mocks.workerWaitUntilReady.mockResolvedValue(undefined);
    mocks.workerRun.mockResolvedValue(undefined);
    mocks.workerClose.mockResolvedValue(undefined);
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
    let ready = Promise.withResolvers<void>();
    mocks.workerWaitUntilReady.mockReturnValue(ready.promise);

    let processor = createBullMqQueue({
      name: 'ready-worker',
      redisUrl: 'redis://localhost:6379'
    }).process(async () => {});
    let starting = processor.start();

    await vi.waitFor(() => expect(mocks.workerConstructed).toHaveBeenCalledOnce());
    expect(mocks.workerRun).not.toHaveBeenCalled();

    ready.resolve();
    await starting;
    expect(mocks.workerRun).toHaveBeenCalledOnce();
  });
});
