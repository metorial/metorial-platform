import {
  provideExecutionContext,
  withExecutionContextOptional
} from '@lowerdeck/execution-context';
import { AsyncLocalStorage } from 'async_hooks';
import PQueue from 'p-queue';
import { db } from './client';

export type TransactionDB = Parameters<Parameters<typeof db.$transaction>[0]>[0];

let tdbStorage = new AsyncLocalStorage<{
  tdb: TransactionDB;
  afterHooks: Array<() => Promise<void | any>>;
  awaitedAfterHooks: Array<() => Promise<void | any>>;
}>();

let afterQueue = new PQueue({ concurrency: Infinity });

export let isInTransaction = () => tdbStorage.getStore() != null;

export let withTransaction = async <T>(
  cb: (tdb: TransactionDB) => Promise<T>,
  opts?: { ifExists?: boolean }
): Promise<T> => {
  let tdb = tdbStorage.getStore();

  if (tdb || opts?.ifExists) {
    // @ts-ignore
    return await (cb as any)((tdb?.tdb ?? db) as any);
  } else {
    let afterHooks: Array<() => Promise<void | any>> = [];
    let awaitedAfterHooks: Array<() => Promise<void | any>> = [];

    let res = await db.$transaction(async tdb => {
      return await tdbStorage.run(
        {
          tdb,
          afterHooks,
          awaitedAfterHooks
        },
        async () => {
          return await cb(tdb);
        }
      );
    });

    // Sequentially, so a hook can rely on the ones registered before it, and awaited, so the work
    // completes before the caller continues and a failure reaches them.
    for (let hook of awaitedAfterHooks) await hook();

    afterQueue.add(async () => {
      let inner = async () => await Promise.all(afterHooks.map(hook => hook()));

      await inner();
    });

    return res;
  }
};

/**
 * Runs the hook once the outermost transaction has committed, before that transaction's caller
 * continues, and surfaces its failures to them.
 *
 * Use this for work that has to observe the committed rows and that the caller should not be able to
 * proceed without, such as copying a written row into another database. Nested calls register on the
 * outermost transaction, so an operation composed of several services still copies once, after
 * everything it wrote is visible.
 */
export let addAwaitedAfterTransactionHook = (hook: () => any) =>
  withExecutionContextOptional(async ctx => {
    let tdb = tdbStorage.getStore();
    let run = () => (ctx ? provideExecutionContext(ctx, hook) : hook());

    // With no transaction to wait for, the rows are already visible.
    if (!tdb) await run();
    else tdb.awaitedAfterHooks.push(run);
  });

export let addAfterTransactionHook = (hook: () => any) =>
  withExecutionContextOptional(async ctx => {
    let tdb = tdbStorage.getStore();

    if (tdb) {
      tdb.afterHooks.push(() => {
        if (ctx) return provideExecutionContext(ctx, hook);
        return hook();
      });
    } else {
      setTimeout(
        () =>
          afterQueue.add(async () => {
            if (ctx) await provideExecutionContext(ctx, hook);
            else await hook();
          }),
        500
      );
    }
  });
