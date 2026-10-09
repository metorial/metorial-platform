import { describe, expect, it, vi } from 'vitest';
import { getSentry } from '@lowerdeck/sentry';
import {
  addAfterHook,
  getExecutionContext,
  provideExecutionContext
} from './with-execution-context';

vi.mock('@lowerdeck/sentry', async () => {
  let { AsyncLocalStorage } = await import('node:async_hooks');
  let scopes = new AsyncLocalStorage<Record<string, unknown>>();
  let root: Record<string, unknown> = {};
  let current = () => scopes.getStore() ?? root;
  let fork = <T>(run: () => T) => scopes.run({ ...current() }, run);

  return {
    getSentry: () => ({
      withIsolationScope: fork,
      withScope: fork,
      startNewTrace: fork,
      startSpan: (_options: unknown, run: () => unknown) => run(),
      setContext: (key: string, value: unknown) => {
        current()[key] = value;
      },
      getIsolationScope: () => ({ getScopeData: () => ({ contexts: current() }) }),
      captureException: vi.fn()
    })
  };
});

let request = {
  type: 'request' as const,
  contextId: 'request',
  ip: '0.0.0.0',
  userAgent: 'test'
};
let cron = { type: 'scheduled' as const, contextId: 'cron', cron: '* * * * *', name: 'test' };
let sentryContext = () =>
  getSentry().getIsolationScope().getScopeData().contexts.executionContext;

describe('execution scope isolation', () => {
  it('keeps a concurrent cron from replacing the request context', async () => {
    let release!: () => void;
    let gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let pending = provideExecutionContext(request, async () => {
      await gate;
      expect(sentryContext()).toMatchObject({ contextId: 'request' });
      expect(getExecutionContext().contextId).toBe('request');
    });

    try {
      await provideExecutionContext(cron, async () => {
        expect(sentryContext()).toMatchObject({ contextId: 'cron' });
      });
    } finally {
      release();
      await pending;
    }

    expect(sentryContext()).toBeUndefined();
  });

  it('restores the parent scope after nested background work', async () => {
    await provideExecutionContext(request, async () => {
      await provideExecutionContext(
        { type: 'job', contextId: 'job', queue: 'test', parent: request },
        async () => {
          expect(sentryContext()).toMatchObject({ contextId: 'job' });
        }
      );
      expect(sentryContext()).toMatchObject({ contextId: 'request' });
    });
    expect(sentryContext()).toBeUndefined();
  });

  it('retains the originating scope in an asynchronous after hook', async () => {
    let release!: () => void;
    let gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let checked!: () => void;
    let complete = new Promise<void>(resolve => {
      checked = resolve;
    });
    await provideExecutionContext(request, async () => {
      await addAfterHook(async () => {
        await gate;
        expect(sentryContext()).toMatchObject({ contextId: 'request' });
        checked();
      });
    });
    await provideExecutionContext(cron, async () => {});
    release();
    await complete;
    expect(sentryContext()).toBeUndefined();
  });
});
