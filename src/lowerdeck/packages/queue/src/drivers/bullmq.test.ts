import { beforeEach, describe, expect, it, vi } from 'vitest';

type FakeScope = {
  setTransactionName: (name: string) => void;
  setTag: (key: string, value: string) => void;
};

let mocks = vi.hoisted(() => ({
  queueConstructed: vi.fn(),
  queueAdd: vi.fn(),
  workerConstructed: vi.fn(),
  workerWaitUntilReady: vi.fn(),
  workerRun: vi.fn(),
  workerClose: vi.fn(),
  captureException: vi.fn(),
  openScopes: [] as { transactionName?: string; tags: Record<string, string> }[],
  scopeDuringCapture: [] as (string | undefined)[]
}));

vi.mock('@lowerdeck/sentry', () => {
  let current: { transactionName?: string; tags: Record<string, string> } | null = null;

  // The driver is not the only consumer of this module, and what the others reach for is
  // beside the point here, so anything unnamed is a no-op.
  let asSentry = (sentry: Record<string, unknown>) =>
    new Proxy(sentry, { get: (target, key) => Reflect.get(target, key) ?? (() => {}) });

  return {
    getSentry: () =>
      asSentry({
        captureException: (...args: unknown[]) => {
          mocks.scopeDuringCapture.push(current?.transactionName);
          return mocks.captureException(...args);
        },
        withIsolationScope: async (cb: (scope: FakeScope) => Promise<unknown>) => {
          let opened: { transactionName?: string; tags: Record<string, string> } = {
            tags: {}
          };
          let previous = current;
          current = opened;
          mocks.openScopes.push(opened);

          try {
            return await cb({
              setTransactionName: name => (opened.transactionName = name),
              setTag: (key, value) => (opened.tags[key] = value)
            });
          } finally {
            current = previous;
          }
        }
      })
  };
});

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
    constructor(_name: string, handler: (job: unknown) => Promise<unknown>) {
      mocks.workerConstructed(handler);
    }

    waitUntilReady = mocks.workerWaitUntilReady;
    run = mocks.workerRun;
    close = mocks.workerClose;
  }
}));

import { createBullMqQueue } from './bullmq';

let startWorker = async (name: string, cb: (payload: any) => Promise<void>) => {
  await createBullMqQueue({ name, redisUrl: 'redis://localhost:6379' }).process(cb).start();

  return mocks.workerConstructed.mock.calls.at(-1)![0] as (job: unknown) => Promise<unknown>;
};

describe('createBullMqQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.openScopes = [];
    mocks.scopeDuringCapture = [];
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

  // Concurrent jobs share the process scope, so without a scope of its own a job inherits the
  // transaction of whichever job ran before it and reports its failures under that name.
  it('gives every job a scope naming the queue it came from', async () => {
    let handler = await startWorker('scoped-queue', async () => {});

    await handler({ id: 'job_1', data: { payload: { value: 1 } }, attemptsMade: 0 });
    await handler({ id: 'job_2', data: { payload: { value: 2 } }, attemptsMade: 0 });

    expect(mocks.openScopes).toEqual([
      {
        transactionName: 'queue process: scoped-queue',
        tags: { queue: 'scoped-queue', 'queue.job_id': 'job_1' }
      },
      {
        transactionName: 'queue process: scoped-queue',
        tags: { queue: 'scoped-queue', 'queue.job_id': 'job_2' }
      }
    ]);
  });

  it('reports a failed job from inside the scope of that job', async () => {
    let handler = await startWorker('failing-queue', async () => {
      throw new Error('job failed');
    });

    await expect(
      handler({ id: 'job_1', data: { payload: {} }, attemptsMade: 0 })
    ).rejects.toThrow('job failed');

    expect(mocks.captureException).toHaveBeenCalledOnce();
    expect(mocks.scopeDuringCapture).toEqual(['queue process: failing-queue']);
  });
});
