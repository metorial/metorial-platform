import {
  provideExecutionContext,
  withExecutionContextOptional
} from '@mtsrc/execution-context';
import { PrismaPg } from '@prisma/adapter-pg';
import { AsyncLocalStorage } from 'async_hooks';
import PQueue from 'p-queue';
import { PrismaClient } from '../prisma/generated/client';

declare global {
  // eslint-disable-next-line no-var
  var __ARES_TEST_DB__: PrismaClient | undefined;
}

let createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
  });

let resolveDb = () => globalThis.__ARES_TEST_DB__ ?? createPrismaClient();

export let db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    let client = resolveDb();
    let value = Reflect.get(client, prop, client);
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

declare global {
  namespace PrismaJson {
    // @ts-ignore
    type EntityImage =
      | { type: 'file'; url?: string; fileUrl?: string }
      | { type: 'url'; url: string }
      | { type: 'default' };
  }
}

export type TransactionDB = Parameters<Parameters<typeof db.$transaction>[0]>[0];

let tdbStorage = new AsyncLocalStorage<{
  tdb: TransactionDB;
  afterHooks: Array<() => Promise<undefined | any>>;
}>();

let afterQueue = new PQueue({ concurrency: Number.POSITIVE_INFINITY });

export let withTransaction = async <T>(
  cb: (tdb: TransactionDB) => Promise<T>,
  opts?: { ifExists?: boolean }
): Promise<T> => {
  let tdb = tdbStorage.getStore();

  if (tdb || opts?.ifExists) {
    return await cb(tdb?.tdb ?? db);
  } else {
    let afterHooks: Array<() => Promise<undefined | any>> = [];

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
