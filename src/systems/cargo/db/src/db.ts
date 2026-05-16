import {
  provideExecutionContext,
  withExecutionContextOptional
} from '@lowerdeck/execution-context';
import { PrismaPg } from '@prisma/adapter-pg';
import { readReplicas } from '@prisma/extension-read-replicas';
import { AsyncLocalStorage } from 'async_hooks';
import PQueue from 'p-queue';
import { PrismaClient } from '../prisma/generated/client';

export type EntityImage =
  | {
      type: 'file';
      fileId: string;
      fileLinkId: string;
      fileReferenceId: string;
      fileUrl: string;
      url?: string;
    }
  | { type: 'url'; url: string }
  | { type: 'default' };
type EntityImageOuter = EntityImage;

let mainAdapter = new PrismaPg({
  connectionString: process.env.CARGO_DATABASE_URL ?? process.env.DATABASE_URL
});

let replicaAdapter = process.env.DATABASE_URL_READER
  ? new PrismaPg({
      connectionString: process.env.DATABASE_URL_READER
    })
  : undefined;

let replicaClient = replicaAdapter ? new PrismaClient({ adapter: replicaAdapter }) : undefined;

let baseClient = new PrismaClient({
  adapter: mainAdapter,
  transactionOptions: {
    maxWait: 10000,
    timeout: 12000
  }
});

if (replicaClient) {
  baseClient = baseClient.$extends(
    readReplicas({ replicas: [replicaClient] })
  ) as any as PrismaClient;
}

export let db = baseClient;

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

declare global {
  namespace PrismaJson {
    type EntityImage = EntityImageOuter;
  }
}
