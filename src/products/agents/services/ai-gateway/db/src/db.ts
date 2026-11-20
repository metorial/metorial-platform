import {
  provideExecutionContext,
  withExecutionContextOptional
} from '@lowerdeck/execution-context';
import type * as Spec from '@mtsrc/ai-gateway-spec';
import { PrismaPg } from '@prisma/adapter-pg';
import { readReplicas } from '@prisma/extension-read-replicas';
import { AsyncLocalStorage } from 'async_hooks';
import PQueue from 'p-queue';
import { PrismaClient } from '../prisma/generated/client';

export * from '../prisma/generated/client';

let mainAdapter = new PrismaPg({
  connectionString: process.env.AI_GATEWAY_DATABASE_URL ?? process.env.DATABASE_URL
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

declare global {
  namespace PrismaJson {
    type InstanceSettings = Spec.InstanceSettings;
    type GatewayTokenLimits = Spec.GatewayTokenLimits;
    type GatewayTokenMetadata = Spec.GatewayTokenMetadata;
    type CatalogSyncCounts = Spec.CatalogSyncCounts;
    type ModelCapabilities = Spec.ModelCapabilities;
    type OfferingVariant = Spec.OfferingVariant;
    type Pricing = Spec.Pricing;
    type ProviderConnectionConfig = Spec.ProviderConnectionConfig;
    type ProviderFeatures = Spec.ProviderFeatures;
    type ConnectionPricingOverride = Spec.ConnectionPricingOverride;
  }
}

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
