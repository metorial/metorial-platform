import {
  provideExecutionContext,
  withExecutionContextOptional
} from '@metorial/execution-context';
import { AsyncLocalStorage } from 'async_hooks';
import PQueue from 'p-queue';
import { db } from './client';

export type TransactionDB = Parameters<Parameters<typeof db.$transaction>[0]>[0];

let tdbStorage = new AsyncLocalStorage<{
  tdb: TransactionDB;
  afterHooks: Array<() => Promise<void | any>>;
}>();

let afterQueue = new PQueue({ concurrency: Infinity });

export let withTransaction = async <T>(
  cb: (tdb: TransactionDB) => Promise<T>,
  opts?: { ifExists?: boolean }
): Promise<T> => {
  let tdb = tdbStorage.getStore();

  if (tdb || opts?.ifExists) {
    return await cb(tdb?.tdb ?? db);
  } else {
    let afterHooks: Array<() => Promise<void | any>> = [];

    let res = await db.$transaction(async tdb => {
      return await tdbStorage.run(
        {
          tdb,
          afterHooks
        },
        async () => {
          return await cb(tdb);
        }
      );
    });

    afterQueue.add(async () => {
      let inner = async () => await Promise.all(afterHooks.map(hook => hook()));

      await inner();
    });

    return res;
  }
};

export let addAfterTransactionHook = (hook: () => any) =>
  withExecutionContextOptional(async ctx => {
    let tdb = tdbStorage.getStore();

    if (tdb) {
      tdb.afterHooks.push(() => {
        if (ctx) return provideExecutionContext(ctx, hook);
        return hook();
      });
    } else {
      console.warn(
        'WARNING: After hook not running in transaction, will execute after 5 seconds instead'
      );

      setTimeout(
        () =>
          afterQueue.add(async () => {
            if (ctx) await provideExecutionContext(ctx, hook);
            else await hook();
          }),
        5000
      );
    }
  });
