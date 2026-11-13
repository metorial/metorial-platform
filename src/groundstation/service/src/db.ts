import type {
  ContentPolicy as SpecContentPolicy,
  IngestTokenLimits as SpecIngestTokenLimits
} from '@metorial/groundstation-spec';
import { PrismaPg } from '@prisma/adapter-pg';
import { readReplicas } from '@prisma/extension-read-replicas';
import { AsyncLocalStorage } from 'async_hooks';
import { PrismaClient } from '../prisma/generated/client';
import type * as Json from './types';

let mainAdapter = new PrismaPg({
  connectionString: process.env.GROUNDSTATION_DATABASE_URL ?? process.env.DATABASE_URL
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

let transactionStorage = new AsyncLocalStorage<TransactionDB>();

export let withTransaction = async <T>(
  cb: (tdb: TransactionDB) => Promise<T>,
  opts?: { ifExists?: boolean }
): Promise<T> => {
  let active = transactionStorage.getStore();
  if (active || opts?.ifExists) return await cb(active ?? db);

  return await db.$transaction(
    async tdb => await transactionStorage.run(tdb, async () => await cb(tdb))
  );
};

declare global {
  namespace PrismaJson {
    type ContentPolicy = SpecContentPolicy;
    type IngestTokenLimits = SpecIngestTokenLimits;
    type IngestTags = Json.IngestTag[];
    type OrganizationSettings = Json.OrganizationSettings;
    type InstanceSettings = Json.InstanceSettings;
    type EntityKindAttributes = Json.EntityKindAttributes;
    type EntityAttributes = Json.EntityAttributes;
    type AttributionRuleMatch = Json.AttributionRuleMatch;
    type ClassifierFeatures = Json.ClassifierFeatures;
  }
}
