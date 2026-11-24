import { afterEach, describe, expect, it, vi } from 'vitest';
import { isReplicaReadScope, withReplicaReads } from './readRouting';
import { createTransactionManager } from './transactions';

let createFakeClient = () => {
  let events: string[] = [];
  let tx = {
    user: { findMany: async () => 'tx' },
    $queryRaw: async () => 'tx-raw',
    $transaction: async () => 'tx-transaction'
  };
  let client = {
    user: { findMany: async () => 'base' },
    $queryRaw: async () => 'base-raw',
    $connect: async () => 'base-connect',
    $transaction: async (cb: (tdb: typeof tx) => Promise<unknown>, _opts?: unknown) => {
      events.push('begin');
      let result = await cb(tx);
      events.push('commit');
      return result;
    }
  };

  return { client, tx, events };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('createTransactionManager', () => {
  it('routes db to the active transaction', async () => {
    let { client } = createFakeClient();
    let { db, withTransaction } = createTransactionManager(client, { name: 'test' });

    expect(await db.user.findMany()).toBe('base');

    await withTransaction(async () => {
      expect(await db.user.findMany()).toBe('tx');
      expect(await db.$queryRaw()).toBe('tx-raw');
      expect(await db.$connect()).toBe('base-connect');
    });
  });

  it('keeps $transaction on the base client', async () => {
    let { client, events } = createFakeClient();
    let { db, withTransaction } = createTransactionManager(client, { name: 'test' });

    await withTransaction(async () => {
      await db.$transaction(async () => 'nested');
    });

    expect(events).toEqual(['begin', 'begin', 'commit', 'commit']);
  });

  it('falls back to the base client after the transaction closed', async () => {
    let { client } = createFakeClient();
    let { db, withTransaction, isInTransaction } = createTransactionManager(client, {
      name: 'test'
    });

    let release!: () => void;
    let gate = new Promise<void>(resolve => (release = resolve));
    let detached!: Promise<[string, boolean]>;

    await withTransaction(async () => {
      detached = gate.then(async () => [await db.user.findMany(), isInTransaction()]);
    });

    release();
    expect(await detached).toEqual(['base', false]);
  });

  it('joins an open transaction and honours ifExists outside one', async () => {
    let { client, events } = createFakeClient();
    let { withTransaction } = createTransactionManager(client, { name: 'test' });

    await withTransaction(() => withTransaction(async () => {}));
    expect(events).toEqual(['begin', 'commit']);

    await withTransaction(async () => {}, { ifExists: true });
    expect(events).toEqual(['begin', 'commit']);
  });

  it('runs after hooks once the outermost transaction committed', async () => {
    let { client, events } = createFakeClient();
    let { withTransaction, addAfterTransactionHook, addAwaitedAfterTransactionHook } =
      createTransactionManager(client, { name: 'test' });

    let afterHookRan = new Promise<void>(resolve =>
      withTransaction(async () => {
        await withTransaction(async () => {
          await addAfterTransactionHook(async () => {
            events.push('after');
            resolve();
          });
          await addAwaitedAfterTransactionHook(async () => events.push('awaited'));
        });
        events.push('outer-end');
      }).then(() => events.push('returned'))
    );

    await afterHookRan;
    await vi.waitFor(() => expect(events).toContain('returned'));

    let withoutAfter = events.filter(event => event !== 'after');
    expect(withoutAfter).toEqual(['begin', 'outer-end', 'commit', 'awaited', 'returned']);
    expect(events.indexOf('after')).toBeGreaterThan(events.indexOf('commit'));
  });

  it('runs hooks registered outside a transaction after the configured delay', async () => {
    vi.useFakeTimers();
    let { client } = createFakeClient();
    let { addAfterTransactionHook } = createTransactionManager(client, {
      name: 'test',
      afterHookDelayMs: 500
    });

    let hook = vi.fn();
    await addAfterTransactionHook(hook);

    await vi.advanceTimersByTimeAsync(499);
    expect(hook).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(hook).toHaveBeenCalledOnce();
  });

  it('does not let failing after hooks escape', async () => {
    let { client } = createFakeClient();
    let errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    let { addAfterTransactionHook } = createTransactionManager(client, { name: 'test' });

    await addAfterTransactionHook(async () => {
      throw new Error('boom');
    });
    await vi.waitFor(() => expect(errors).toHaveBeenCalled());
    errors.mockRestore();
  });

  it('runs after hooks with primary reads even from a replica scope', async () => {
    let { client } = createFakeClient();
    let { withTransaction, addAwaitedAfterTransactionHook } = createTransactionManager(
      client,
      {
        name: 'test'
      }
    );

    let sawReplicaScope: boolean | undefined;
    await withReplicaReads(() =>
      withTransaction(() =>
        addAwaitedAfterTransactionHook(async () => {
          sawReplicaScope = isReplicaReadScope();
        })
      )
    );

    expect(sawReplicaScope).toBe(false);
  });
});
