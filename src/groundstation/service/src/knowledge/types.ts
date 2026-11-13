import type {
  Agent,
  Endpoint,
  Family,
  Model,
  Name,
  Offering,
  Organization,
  Pointer,
  Pricing,
  Release,
  Vendor
} from '@metorial/model-catalog/src/types';

export type KnowledgeEntityName =
  | 'organization'
  | 'family'
  | 'model'
  | 'release'
  | 'pointer'
  | 'vendor'
  | 'endpoint'
  | 'offering'
  | 'name'
  | 'agent';

export type KnowledgeEntityCounts = {
  total: number;
  added: number;
  changed: number;
  removed: number;
};

export type KnowledgeSnapshotCounts = Partial<
  Record<KnowledgeEntityName, KnowledgeEntityCounts>
>;

export type KnowledgeAnomalyKind =
  'history_reset' | 'removed' | 'id_churn' | 'dangling_reference' | 'first_seen_regressed';

export type KnowledgeSnapshotAnomaly = {
  kind: KnowledgeAnomalyKind;
  entity?: KnowledgeEntityName;
  count: number;
  sample: string[];
};

export type KnowledgeEntityData =
  | Organization
  | Family
  | Model
  | Release
  | Pointer
  | Vendor
  | Endpoint
  | Offering
  | Name
  | Agent;

export type VendorSource = 'reported' | 'endpoint' | 'offering' | 'agent' | 'first-party';

export type RebuildFilter = {
  modelIds?: string[];
  modelRaws?: string[];
  vendorIds?: string[];
};

export type {
  Agent as KnowledgeAgentData,
  Endpoint as KnowledgeEndpointData,
  Family as KnowledgeFamilyData,
  Model as KnowledgeModelData,
  Name as KnowledgeNameData,
  Offering as KnowledgeOfferingData,
  Organization as KnowledgeOrganizationData,
  Pointer as KnowledgePointerData,
  Pricing as KnowledgePricing,
  Release as KnowledgeReleaseData,
  Vendor as KnowledgeVendorData
};
