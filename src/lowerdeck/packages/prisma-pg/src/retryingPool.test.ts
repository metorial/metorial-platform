import { ctxStorage } from '@lowerdeck/execution-context';
import { getSentry } from '@lowerdeck/sentry';
import type { EventProcessor } from '@sentry/core';
import type { PoolClient, PoolConfig } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakePg, dnsError } from '../test/fakeClient';
import { createPrismaPgAdapter } from './index';
import { getErrorDetails } from './reporting';
import { RetryingPool } from './retryingPool';

let captured = vi.hoisted(() => ({
  events: [] as {
    message: string;
    options: any;
    tags: Record<string, unknown>;
    processors: EventProcessor[];
  }[],
  throwOnCapture: false
}));

vi.mock('@lowerdeck/sentry', async importOriginal => {
  let original = await importOriginal<typeof import('@lowerdeck/sentry')>();
  let core = await import('@sentry/core');

  return {
    ...original,
    getSentry: () => ({
      ...core,
      captureMessage: (message: string, options: unknown) => {
        if (captured.throwOnCapture) throw new Error('Reporting failed');

        let data = core.getCurrentScope().getScopeData();
        captured.events.push({
          message,
          options,
          tags: data.tags,
          processors: data.eventProcessors
        });
        return 'event-id';
      }
    })
  };
});

let pools: RetryingPool[] = [];

let createPool = (
  environment = 'staging',
  config: PoolConfig & { onConnect?: (client: PoolClient) => Promise<void> } = {}
) => {
  let driver = createFakePg();
  let pool = new RetryingPool(
    {
      Client: driver.Client,
      connectionString:
        'postgresql://private-user:private-password@database.test:5434/private-db',
      idleTimeoutMillis: 0,
      ...config
    },
    { environment, databaseName: 'test-database', role: 'primary' }
  );

  pools.push(pool);
  return { pool, ...driver };
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});

  captured.events = [];
  captured.throwOnCapture = false;
});

afterEach(async () => {
  await Promise.all(pools.filter(pool => !pool.ending).map(pool => pool.end()));
  pools = [];

  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('connection acquisition', () => {
  it.each([1, 2])(
    'recovers after %i failures and releases the acquired client',
    async failures => {
      let { pool, state } = createPool();
      state.connectErrors = Array.from({ length: failures }, () => dnsError());

      let pending = pool.connect();
      await vi.runAllTimersAsync();
      let client = await pending;

      expect(state.connectCount).toBe(failures + 1);
      expect(pool.totalCount).toBe(1);
      expect(
        captured.events.map(event => event.options.contexts.databaseConnectionRetry.type)
      ).toEqual([...Array(failures).fill('scheduled'), 'recovered']);

      client.release();
      expect(pool.idleCount).toBe(1);
    }
  );

  it('preserves the callback release function', async () => {
    let { pool, state } = createPool();
    state.connectErrors = [dnsError()];

    let done = vi.fn((_error, client, release) => {
      expect(release).toBe(client.release);
      release();
    });
    pool.connect(done);
    await vi.runAllTimersAsync();

    expect(done).toHaveBeenCalledOnce();
    expect(pool.idleCount).toBe(1);
  });

  it('rejects with the latest original error after three attempts', async () => {
    let { pool, state } = createPool();
    let errors = [dnsError(), dnsError(), dnsError()];
    state.connectErrors = [...errors];

    let pending = expect(pool.connect()).rejects.toBe(errors[2]);
    await vi.runAllTimersAsync();
    await pending;

    expect(state.connectCount).toBe(3);
    expect(captured.events.at(-1)?.options.contexts.databaseConnectionRetry).toMatchObject({
      type: 'exhausted',
      reason: 'attempts',
      attempt: 3
    });
  });

  it.each(['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', '28P01', 'P1001', '42601'])(
    'does not retry %s',
    async code => {
      let { pool, state } = createPool();
      let error = dnsError(code);
      state.connectErrors = [error];

      await expect(pool.connect()).rejects.toBe(error);
      expect(state.connectCount).toBe(1);
      expect(captured.events).toHaveLength(0);
    }
  );

  it('recognizes structured causes, handles cycles, and ignores message-only matches', async () => {
    let { pool, state } = createPool();
    state.connectErrors = [new Error('Wrapped', { cause: dnsError() })];

    let pending = pool.connect();
    await vi.runAllTimersAsync();
    (await pending).release();
    expect(state.connectCount).toBe(2);

    let cycle = { message: 'EAI_AGAIN', cause: undefined as unknown };
    cycle.cause = cycle;
    expect(getErrorDetails(cycle)).toEqual({});
    expect(getErrorDetails(new Error('EAI_AGAIN'))).toEqual({});
    expect(
      getErrorDetails({
        code: 'postgres://private-password@database.test',
        syscall: 'private sql'
      })
    ).toEqual({});
  });

  it('stops when a later error is not retryable', async () => {
    let { pool, state } = createPool();
    let permanent = dnsError('ENOTFOUND');
    state.connectErrors = [dnsError(), permanent];

    let pending = expect(pool.connect()).rejects.toBe(permanent);
    await vi.runAllTimersAsync();
    await pending;

    expect(state.connectCount).toBe(2);
    expect(captured.events.at(-1)?.options.contexts.databaseConnectionRetry.reason).toBe(
      'non_retryable'
    );
  });

  it('does not replay a query that fails after dispatch', async () => {
    let { pool, state } = createPool();
    state.queryError = dnsError();

    await expect(pool.query('UPDATE counter SET value = value + 1')).rejects.toBe(
      state.queryError
    );
    expect(state.connectCount).toBe(1);
    expect(state.queries).toHaveLength(1);
    expect(captured.events).toHaveLength(0);
  });

  it('does not retry DNS errors from a post-connection setup hook', async () => {
    let error = dnsError();
    let { pool, state } = createPool('staging', {
      onConnect: async client => {
        await client.query('UPDATE counter SET value = value + 1');
        throw error;
      }
    });

    await expect(pool.connect()).rejects.toBe(error);

    expect(state.connectCount).toBe(1);
    expect(state.queries).toHaveLength(1);
    expect(captured.events).toHaveLength(0);
  });

  it('cancels backoff during shutdown and preserves the acquisition error', async () => {
    let { pool, state } = createPool();
    let error = dnsError();
    state.connectErrors = [error];

    let pending = expect(pool.connect()).rejects.toBe(error);
    await Promise.resolve();
    await pool.end();
    await pending;
    await vi.runAllTimersAsync();

    expect(state.connectCount).toBe(1);
    expect(captured.events.at(-1)?.options.contexts.databaseConnectionRetry.reason).toBe(
      'shutdown'
    );
  });

  it('does not schedule an attempt outside the elapsed-time budget', async () => {
    let { pool, state } = createPool();
    let error = dnsError();
    state.connectErrors = [error];
    state.connected = () => vi.advanceTimersByTime(950);

    await expect(pool.connect()).rejects.toBe(error);
    expect(state.connectCount).toBe(1);
    expect(captured.events).toHaveLength(0);
  });

  it('reports budget exhaustion after a retry', async () => {
    let { pool, state } = createPool();
    state.connectErrors = [dnsError(), dnsError()];
    state.connected = () => {
      if (state.connectCount === 2) vi.advanceTimersByTime(850);
    };

    let pending = expect(pool.connect()).rejects.toBeDefined();
    await vi.runAllTimersAsync();
    await pending;

    expect(state.connectCount).toBe(2);
    expect(captured.events.at(-1)?.options.contexts.databaseConnectionRetry).toMatchObject({
      type: 'exhausted',
      reason: 'budget',
      attempt: 2
    });
  });

  it('does not acquire when an event-loop delay takes backoff past the budget', async () => {
    let { pool, state } = createPool();
    state.connectErrors = [dnsError()];

    let pending = expect(pool.connect()).rejects.toBeDefined();
    await Promise.resolve();
    vi.spyOn(performance, 'now').mockReturnValue(1100);
    await vi.runAllTimersAsync();
    await pending;

    expect(state.connectCount).toBe(1);
    expect(captured.events.at(-1)?.options.contexts.databaseConnectionRetry.reason).toBe(
      'budget'
    );
  });

  it('preserves caller context when a queued acquisition starts from another request', async () => {
    let { pool, state } = createPool();
    pool.options.max = 1;
    let held = await pool.connect();
    state.connectErrors = [dnsError()];
    let completedIn = '';

    let pending = new Promise<void>((resolve, reject) => {
      ctxStorage.run({ context: { type: 'unknown', contextId: 'initiator' } }, () => {
        pool.connect((error, client) => {
          if (error) return reject(error);

          completedIn = ctxStorage.getStore()?.context.contextId ?? '';
          client!.release();
          resolve();
        });
      });
    });

    ctxStorage.run({ context: { type: 'unknown', contextId: 'releaser' } }, () =>
      held.release(true)
    );
    await vi.runAllTimersAsync();
    await pending;

    expect(completedIn).toBe('initiator');
    expect(
      captured.events.every(
        event =>
          event.options.contexts.databaseConnectionRetry.executionContextId === 'initiator'
      )
    ).toBe(true);
  });

  it.each([0, 1])('keeps jitter within its bounds for random=%i', async random => {
    vi.mocked(Math.random).mockReturnValue(random);
    let { pool, state } = createPool();
    state.connectErrors = [dnsError(), dnsError()];

    let pending = pool.connect();
    await vi.runAllTimersAsync();
    (await pending).release();

    expect(
      captured.events
        .slice(0, 2)
        .map(event => event.options.contexts.databaseConnectionRetry.backoffMs)
    ).toEqual([100 * (0.5 + random), 200 * (0.5 + random)]);
  });
});

describe('factory and telemetry', () => {
  it.each(['production', undefined, 'preview', 'test'])(
    'uses the native pool without retry hooks for %s',
    async environment => {
      let driver = createFakePg();
      driver.state.connectErrors = [dnsError()];
      let factory = createPrismaPgAdapter(
        { Client: driver.Client },
        {
          environment,
          databaseName: 'test',
          role: 'primary'
        }
      );
      let adapter = await factory.connect();
      let pool = adapter.underlyingDriver();

      expect(pool).not.toBeInstanceOf(RetryingPool);
      await expect(
        adapter.queryRaw({ sql: 'SELECT 1', args: [], argTypes: [] })
      ).rejects.toBeDefined();
      expect(driver.state.connectCount).toBe(1);
      expect(captured.events).toHaveLength(0);
      await adapter.dispose();
      expect(pool.ended).toBe(true);
    }
  );

  it('enables staging even with NODE_ENV=production and disposes its owned pool', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    let driver = createFakePg();
    driver.state.connectErrors = [dnsError()];
    let factory = createPrismaPgAdapter(
      { Client: driver.Client, max: 3, connectionTimeoutMillis: 5000 },
      {
        environment: 'staging',
        databaseName: 'test',
        role: 'replica'
      }
    );
    let adapter = await factory.connect();
    let pool = adapter.underlyingDriver();

    expect(pool).toBeInstanceOf(RetryingPool);
    expect(pool.options).toMatchObject({ max: 3, connectionTimeoutMillis: 5000 });
    let pending = adapter.queryRaw({ sql: 'SELECT 1', args: [], argTypes: [] });
    await vi.runAllTimersAsync();
    await pending;
    await adapter.dispose();

    expect(pool.ended).toBe(true);
    expect(captured.events[0]?.options.tags['database.role']).toBe('replica');
    vi.unstubAllEnvs();
  });

  it('logs development retries locally without sending Sentry events', async () => {
    let { pool, state } = createPool('development');
    state.connectErrors = [dnsError()];

    let pending = pool.connect();
    await vi.runAllTimersAsync();
    (await pending).release();

    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.info).toHaveBeenCalledOnce();
    expect(captured.events).toHaveLength(0);
  });

  it('reports context without credentials, SQL, error messages, or baggage', async () => {
    let { pool, state } = createPool();
    let error = dnsError();
    error.message += ' secret-error-message';
    state.connectErrors = [error];

    let pending = ctxStorage.run(
      {
        context: {
          type: 'job',
          contextId: 'job-123',
          queue: 'test/queue',
          trace: { traceparent: '00-trace-span-01', baggage: 'private-baggage' }
        }
      },
      () => pool.connect()
    );
    await vi.runAllTimersAsync();
    (await pending).release();

    let event = captured.events[0]!;
    expect(event.options.contexts.databaseConnectionRetry).toMatchObject({
      hostname: 'database.test',
      port: 5434,
      executionContextId: 'job-123',
      executionContextType: 'job',
      queue: 'test/queue',
      attempt: 1,
      nextAttempt: 2,
      code: 'EAI_AGAIN',
      syscall: 'getaddrinfo',
      backoffMs: 100
    });
    expect(event.options.fingerprint).not.toContain(
      event.options.contexts.databaseConnectionRetry.retryId
    );

    let serialized = JSON.stringify(captured.events);
    for (let secret of [
      'private-user',
      'private-password',
      'private-db',
      'private-baggage',
      'secret-error-message'
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('keeps concurrent request contexts and Sentry scopes separate', async () => {
    let sentry = getSentry();
    let first = createPool();
    let second = createPool();
    first.state.connectErrors = [dnsError()];
    second.state.connectErrors = [dnsError()];

    let connect = (pool: RetryingPool, id: string) =>
      sentry.withScope(scope => {
        scope.setTag('request-id', id);
        return ctxStorage.run({ context: { type: 'unknown', contextId: id } }, () =>
          pool.connect()
        );
      });
    let pending = [connect(first.pool, 'first'), connect(second.pool, 'second')];
    await vi.runAllTimersAsync();
    for (let client of await Promise.all(pending)) client.release();

    for (let event of captured.events) {
      expect(event.tags['request-id']).toBe(
        event.options.contexts.databaseConnectionRetry.executionContextId
      );
    }
    expect(
      new Set(
        captured.events.map(event => event.options.contexts.databaseConnectionRetry.retryId)
      ).size
    ).toBe(2);
  });

  it('strips sensitive inherited scope data from retry events', async () => {
    let { pool, state } = createPool();
    state.connectErrors = [dnsError()];

    let pending = pool.connect();
    await vi.runAllTimersAsync();
    (await pending).release();

    let processor = captured.events[0]!.processors.at(-1)!;
    let hint = { attachments: [{ filename: 'private-request-body', data: 'private' }] };
    let event = await processor(
      {
        request: { data: 'private-request-body' },
        user: { email: 'private-email' },
        extra: { sql: 'private-sql' },
        breadcrumbs: [{ message: 'private-breadcrumb' }],
        contexts: {
          executionContext: { baggage: 'private-baggage' },
          trace: {
            trace_id: 'initiating-trace',
            span_id: 'initiating-span',
            data: { secret: 'private-trace' }
          }
        }
      },
      hint
    );

    expect(event?.contexts?.trace).toMatchObject({
      trace_id: 'initiating-trace',
      span_id: 'initiating-span'
    });
    expect(hint.attachments).toEqual([]);
    expect(JSON.stringify(event)).not.toContain('private-');
  });

  it('does not let a reporting failure affect recovery', async () => {
    captured.throwOnCapture = true;
    let { pool, state } = createPool();
    state.connectErrors = [dnsError()];

    let pending = pool.connect();
    await vi.runAllTimersAsync();
    (await pending).release();
    expect(state.connectCount).toBe(2);
  });
});
