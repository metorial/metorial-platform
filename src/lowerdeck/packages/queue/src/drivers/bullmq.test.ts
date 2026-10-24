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
  scopeDuringCapture: [] as (string | undefined)[],
  contextDuringCapture: [] as unknown[],
  databaseConflictDuringCapture: [] as unknown[],
  delay: vi.fn()
}));

vi.mock('@lowerdeck/sentry', () => {
  let current: { transactionName?: string; tags: Record<string, string> } | null = null;
  let contexts = new WeakMap<object, Record<string, unknown>>();

  // The driver is not the only consumer of this module, and what the others reach for is
  // beside the point here, so anything unnamed is a no-op.
  let asSentry = (sentry: Record<string, unknown>) =>
    new Proxy(sentry, { get: (target, key) => Reflect.get(target, key) ?? (() => {}) });

  return {
    getSentry: () =>
      asSentry({
        setContext: (name: string, value: unknown) => {
          if (current) {
            let context = contexts.get(current) ?? {};
            context[name] = value;
            contexts.set(current, context);
          }
        },
        withScope: async (run: () => unknown) => await run(),
        startNewTrace: async (run: () => unknown) => await run(),
        startSpan: async (_options: unknown, run: () => unknown) => await run(),
        captureException: (...args: unknown[]) => {
          mocks.scopeDuringCapture.push(current?.transactionName);
          mocks.contextDuringCapture.push(current && contexts.get(current)?.executionContext);
          mocks.databaseConflictDuringCapture.push(
            current && contexts.get(current)?.databaseConflict
          );
          return mocks.captureException(...args);
        },
        withIsolationScope: async (cb: (scope: FakeScope) => Promise<unknown>) => {
          let opened: { transactionName?: string; tags: Record<string, string> } = {
            transactionName: current?.transactionName,
            tags: { ...current?.tags }
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

vi.mock('@lowerdeck/delay', () => ({ delay: mocks.delay }));

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

import { createBullMqQueue, getBackoffDelayMs } from './bullmq';

let startWorker = async (
  name: string,
  cb: (payload: any) => Promise<void>,
  jobOpts?: { attempts: number }
) => {
  await createBullMqQueue({ name, redisUrl: 'redis://localhost:6379', jobOpts })
    .process(cb)
    .start();

  return mocks.workerConstructed.mock.calls.at(-1)![0] as (job: unknown) => Promise<unknown>;
};

describe('createBullMqQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.openScopes = [];
    mocks.scopeDuringCapture = [];
    mocks.contextDuringCapture = [];
    mocks.databaseConflictDuringCapture = [];
    mocks.delay.mockResolvedValue(undefined);
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

    expect(
      Array.from(
        new Map(mocks.openScopes.map(scope => [scope.tags['queue.job_id'], scope])).values()
      )
    ).toEqual([
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

    expect(mocks.contextDuringCapture).toEqual([
      expect.objectContaining({ type: 'job', queue: 'failing-queue', contextId: 'job_1' })
    ]);
    expect(mocks.captureException).toHaveBeenCalledOnce();
    expect(mocks.scopeDuringCapture).toEqual(['queue process: failing-queue']);
  });

  describe('retry backoff', () => {
    it('spreads each retry between half and one and a half times the exponential delay', () => {
      expect(getBackoffDelayMs(1, () => 0)).toBe(500);
      expect(getBackoffDelayMs(1, () => 0.5)).toBe(1000);
      expect(getBackoffDelayMs(3, () => 0)).toBe(2000);
      expect(getBackoffDelayMs(3, () => 0.999)).toBeCloseTo(5996, 0);
    });

    it('never exceeds ten minutes', () => {
      expect(getBackoffDelayMs(25, () => 0.999)).toBe(10 * 60 * 1000);
    });
  });

  describe('database conflicts', () => {
    let wrappers = [
      { name: 'direct', wrap: (error: object) => error },
      { name: 'cause', wrap: (error: object) => new Error('wrapped', { cause: error }) },
      { name: 'meta', wrap: (error: object) => ({ meta: error }) },
      {
        name: 'driver adapter',
        wrap: (error: object) => ({ meta: { driverAdapterError: { cause: error } } })
      }
    ];

    describe.each(['P2034', '40P01', '40001'])('%s', code => {
      it.each(wrappers)('quietly retries a $name conflict', async ({ wrap }) => {
        let error = wrap(Object.assign(new Error('database conflict'), { code }));
        let handler = await startWorker('conflict-queue', async () => {
          throw error;
        });

        await expect(
          handler({ id: 'job_1', data: { payload: {} }, attemptsMade: 0 })
        ).rejects.toBe(error);

        expect(mocks.captureException).not.toHaveBeenCalled();
        expect(mocks.delay).toHaveBeenCalledExactlyOnceWith(expect.any(Number));
        expect(mocks.delay.mock.calls[0]![0]).toBeGreaterThanOrEqual(1000);
        expect(mocks.delay.mock.calls[0]![0]).toBeLessThan(6000);
      });

      it.each([
        { name: 'default', attemptsMade: 24, attemptLimit: 25 },
        { name: 'queue override', attemptsMade: 2, attemptLimit: 3, queueAttempts: 3 },
        {
          name: 'job override',
          attemptsMade: 1,
          attemptLimit: 2,
          queueAttempts: 3,
          jobAttempts: 2
        },
        { name: 'single attempt', attemptsMade: 0, attemptLimit: 1, jobAttempts: 1 }
      ])('reports exhaustion with a $name budget', async d => {
        let error = new Error('wrapped', { cause: { code } });
        let handler = await startWorker(
          'exhausted-conflict-queue',
          async () => {
            throw error;
          },
          d.queueAttempts ? { attempts: d.queueAttempts } : undefined
        );

        await expect(
          handler({
            id: 'job_1',
            data: { payload: {} },
            attemptsMade: d.attemptsMade,
            opts: d.jobAttempts ? { attempts: d.jobAttempts } : undefined
          })
        ).rejects.toBe(error);

        expect(mocks.captureException).toHaveBeenCalledExactlyOnceWith(error);
        expect(mocks.databaseConflictDuringCapture).toEqual([
          { code, retryCount: d.attemptsMade, attemptLimit: d.attemptLimit }
        ]);
        expect(mocks.scopeDuringCapture).toEqual(['queue process: exhausted-conflict-queue']);
        expect(mocks.delay).not.toHaveBeenCalled();
      });
    });

    it('finds a conflict beyond a cyclic branch', async () => {
      let error: { cause?: unknown; meta?: unknown } = {};
      error.cause = error;
      error.meta = { driverAdapterError: { code: 'P2034' } };

      let handler = await startWorker('cyclic-conflict-queue', async () => {
        throw error;
      });

      await expect(
        handler({ id: 'job_1', data: { payload: {} }, attemptsMade: 0 })
      ).rejects.toBe(error);

      expect(mocks.captureException).not.toHaveBeenCalled();
    });

    it.each([
      { code: 'P2002' },
      { code: 'P2028' },
      new Error('Transaction failed due to a write conflict or a deadlock'),
      null
    ])('reports unrelated errors immediately: %j', async error => {
      let handler = await startWorker('unrelated-error-queue', async () => {
        throw error;
      });

      await expect(
        handler({ id: 'job_1', data: { payload: {} }, attemptsMade: 0 })
      ).rejects.toBe(error);

      expect(mocks.captureException).toHaveBeenCalledExactlyOnceWith(error);
      expect(mocks.databaseConflictDuringCapture).toEqual([undefined]);
      expect(mocks.delay).not.toHaveBeenCalled();
    });

    it('reports cyclic errors without conflict codes immediately', async () => {
      let error: { cause?: unknown } = {};
      error.cause = error;

      let handler = await startWorker('cyclic-error-queue', async () => {
        throw error;
      });

      await expect(
        handler({ id: 'job_1', data: { payload: {} }, attemptsMade: 0 })
      ).rejects.toBe(error);

      expect(mocks.captureException).toHaveBeenCalledExactlyOnceWith(error);
    });

    it('preserves recognition of the exact PostgreSQL deadlock message', async () => {
      let error = new Error('deadlock detected');
      let handler = await startWorker('deadlock-queue', async () => {
        throw error;
      });

      await expect(
        handler({ id: 'job_1', data: { payload: {} }, attemptsMade: 0 })
      ).rejects.toBe(error);

      expect(mocks.captureException).not.toHaveBeenCalled();
    });
  });

  describe('lock contention', () => {
    let createContentionError = (isContention: boolean) =>
      Object.assign(new Error('unable to achieve a quorum'), {
        name: 'LockAcquisitionError',
        isContention
      });

    it('retries a contended job without reporting it while attempts remain', async () => {
      let error = createContentionError(true);
      let handler = await startWorker('contended-queue', async () => {
        throw error;
      });

      await expect(
        handler({
          id: 'job_1',
          data: { payload: {} },
          attemptsMade: 3,
          opts: { attempts: 25 }
        })
      ).rejects.toBe(error);

      expect(mocks.captureException).not.toHaveBeenCalled();
    });

    it('reports a contended job once it is on its last attempt', async () => {
      let error = createContentionError(true);
      let handler = await startWorker('exhausted-queue', async () => {
        throw error;
      });

      await expect(
        handler({
          id: 'job_1',
          data: { payload: {} },
          attemptsMade: 24,
          opts: { attempts: 25 }
        })
      ).rejects.toBe(error);

      expect(mocks.captureException).toHaveBeenCalledWith(error);
    });

    it('reports lock failures that were not caused by contention', async () => {
      let error = createContentionError(false);
      let handler = await startWorker('unavailable-queue', async () => {
        throw error;
      });

      await expect(
        handler({
          id: 'job_1',
          data: { payload: {} },
          attemptsMade: 0,
          opts: { attempts: 25 }
        })
      ).rejects.toBe(error);

      expect(mocks.captureException).toHaveBeenCalledWith(error);
    });

    it('recognises a contended lock failure wrapped in another error', async () => {
      let error = new Error('wrapped', { cause: createContentionError(true) });
      let handler = await startWorker('wrapped-queue', async () => {
        throw error;
      });

      await expect(
        handler({
          id: 'job_1',
          data: { payload: {} },
          attemptsMade: 0,
          opts: { attempts: 25 }
        })
      ).rejects.toBe(error);

      expect(mocks.captureException).not.toHaveBeenCalled();
    });
  });
});
