import type * as Spec from '@mtsrc/agent-tracking-spec';
import { createDatabase } from '@lowerdeck/prisma-pg';
import { PrismaClient } from '../prisma/generated/client';
import type * as Knowledge from './json/knowledge';
import type { RebuildFilter as LayersRebuildFilter } from '@mtsrc/agent-tracking-layers';
import type { AttributionRuleMatch as RuleMatch } from '@mtsrc/agent-tracking-rule-match';

let database = createDatabase({
  name: 'agent-tracking',
  url: ['AGENT_TRACKING_DATABASE_URL', 'DATABASE_URL'],
  createClient: adapter =>
    new PrismaClient({
      adapter,
      transactionOptions: {
        maxWait: 10000,
        timeout: 12000
      }
    })
});

export let db = database.db;

export type TransactionDB = Parameters<Parameters<typeof db.$transaction>[0]>[0];

export let withTransaction = <T>(
  cb: (tdb: TransactionDB) => Promise<T>,
  opts?: { ifExists?: boolean; timeoutMs?: number }
): Promise<T> =>
  database.withTransaction(cb, { ifExists: opts?.ifExists, timeout: opts?.timeoutMs });

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
