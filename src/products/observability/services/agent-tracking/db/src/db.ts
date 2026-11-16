import type * as Spec from '@mtsrc/agent-tracking-spec';
import { PrismaPg } from '@prisma/adapter-pg';
import { readReplicas } from '@prisma/extension-read-replicas';
import { AsyncLocalStorage } from 'async_hooks';
import { PrismaClient } from '../prisma/generated/client';
import type * as Knowledge from './json/knowledge';
import type { RebuildFilter as LayersRebuildFilter } from '@mtsrc/agent-tracking-layers';
import type { AttributionRuleMatch as RuleMatch } from '@mtsrc/agent-tracking-rule-match';

let mainAdapter = new PrismaPg({
  connectionString: process.env.AGENT_TRACKING_DATABASE_URL ?? process.env.DATABASE_URL
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
  opts?: { ifExists?: boolean; timeoutMs?: number }
): Promise<T> => {
  let active = transactionStorage.getStore();
  if (active || opts?.ifExists) return await cb(active ?? db);

  return await db.$transaction(
    async tdb => await transactionStorage.run(tdb, async () => await cb(tdb)),
    opts?.timeoutMs ? { timeout: opts.timeoutMs } : undefined
  );
};

declare global {
  namespace PrismaJson {
    type ContentPolicy = Spec.ContentPolicy;
    type IngestTokenLimits = Spec.IngestTokenLimits;
    type IngestTags = Spec.IngestTag[];
    type OrganizationSettings = Spec.OrganizationSettings;
    type InstanceSettings = Spec.InstanceSettings;
    type EntityKindAttributes = Spec.EntityKindAttributes;
    type EntityAttributes = Spec.EntityAttributes;
    type AttributionRuleMatch = RuleMatch;
    type ClassifierFeatures = Spec.ClassifierFeatures;
    type RebuildFilter = LayersRebuildFilter;
    type KnowledgeSnapshotCounts = Knowledge.KnowledgeSnapshotCounts;
    type KnowledgeSnapshotAnomalies = Knowledge.KnowledgeSnapshotAnomaly[];
    type KnowledgeOrganizationData = Knowledge.KnowledgeOrganizationData;
    type KnowledgeFamilyData = Knowledge.KnowledgeFamilyData;
    type KnowledgeModelData = Knowledge.KnowledgeModelData;
    type KnowledgeReleaseData = Knowledge.KnowledgeReleaseData;
    type KnowledgePointerData = Knowledge.KnowledgePointerData;
    type KnowledgeVendorData = Knowledge.KnowledgeVendorData;
    type KnowledgeEndpointData = Knowledge.KnowledgeEndpointData;
    type KnowledgeOfferingData = Knowledge.KnowledgeOfferingData;
    type KnowledgeNameData = Knowledge.KnowledgeNameData;
    type KnowledgeAgentData = Knowledge.KnowledgeAgentData;
    type KnowledgeEntityData = Knowledge.KnowledgeEntityData;
    type KnowledgePricing = Knowledge.KnowledgePricing;
    type CanonicalQuery = Spec.CanonicalQuery;
    type QueryExportScope = Spec.QueryExportScope;
    type QueryExportParts = Spec.QueryExportPart[];
  }
}
