import type {
  KnowledgeChangeWithSnapshot,
  KnowledgePricePeriodWithOffering,
  KnowledgeSnapshotSummary
} from '@mtsrc/agent-tracking-module-knowledge';

export let knowledgePricePeriodPresenter = (period: KnowledgePricePeriodWithOffering) => ({
  object: 'agent_tracking#knowledge_price_period',

  id: period.id,
  offeringId: period.offering.id,
  vendorId: period.vendorId,
  modelId: period.modelId,
  pricing: period.pricing,

  origin: period.origin,
  closeReason: period.closeReason,
  correctionReason: period.correctionReason,
  correctedBy: period.correctedBy,

  validFrom: period.validFrom,
  validTo: period.validTo,
  confirmedAt: period.confirmedAt,
  createdAt: period.createdAt,
  updatedAt: period.updatedAt
});

export let knowledgeChangePresenter = (change: KnowledgeChangeWithSnapshot) => ({
  object: 'agent_tracking#knowledge_change',

  id: change.id,
  entity: change.entity,
  entityId: change.entityId,
  change: change.change,
  before: change.before,
  after: change.after,
  snapshotId: change.snapshot.id,

  createdAt: change.createdAt
});

export let knowledgeSnapshotPresenter = (snapshot: KnowledgeSnapshotSummary) => ({
  object: 'agent_tracking#knowledge_snapshot',

  id: snapshot.id,
  fingerprint: snapshot.fingerprint,
  schemaVersion: snapshot.schemaVersion,
  status: snapshot.status,
  rejectedReason: snapshot.rejectedReason,
  counts: snapshot.counts,
  anomalies: snapshot.anomalies,
  hasArchive: snapshot.hasArchive,
  source: { id: snapshot.source.id, url: snapshot.source.url },

  generatedAt: snapshot.generatedAt,
  acceptedAt: snapshot.acceptedAt,
  createdAt: snapshot.createdAt,
  updatedAt: snapshot.updatedAt
});
