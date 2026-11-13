import type { BillingMode, BillingSource } from '@metorial/groundstation-spec';
import mongoose from 'mongoose';
import type { VendorSource } from '../knowledge/types';
import type { TagOrigin } from '../types';

export let derivedCollectionNames = {
  sessions: 'sessions',
  sessionLinks: 'session_links',
  usageSlices: 'usage_slices',
  sourceHealth: 'source_health'
} as const;

export type Decimal = mongoose.Types.Decimal128;

export type Tokens = {
  inputUncached: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
  reasoning: number;
};

export type ReportedCost = {
  unit: string;
  basis: string;
  amount: Decimal;
};

export type SessionTag = { k: string; v: string; origin: TagOrigin };

export type AttributionSource =
  'manual' | 'credential' | 'tag' | 'observed' | 'rule' | 'derived' | 'classifier';

export type AttributionEntry = {
  kind: string;
  entityId: string;
  role?: 'principal' | 'initiator';
  source: AttributionSource;
  weight: number;
  confidence?: number;
  via?: string[];
  ruleId?: string;
};

export type ManualAssignment = {
  kind: string;
  entityId: string | null;
  at: Date;
};

export type ClassificationCandidate = { entityId: string; confidence: number };

export type ClassificationStage = 'ticket' | 'prior' | 'clef' | 'review';

export type ClassificationReview = {
  action: 'accept' | 'reject';
  entityId?: string;
  at: Date;
};

export type ClassificationResult = {
  kind: string;
  stage: ClassificationStage;
  candidates: ClassificationCandidate[];
  accepted?: ClassificationCandidate;
  rejectedEntityIds?: string[];
  review?: ClassificationReview;
};

export type SessionClassification = {
  status: 'pending' | 'accepted' | 'needs_review' | 'rejected' | 'skipped';
  runs: number;
  clefCalls?: number;
  contextHash?: string;
  results: ClassificationResult[];
  at: Date;
};

export type SessionModelSummary = {
  modelId?: string;
  rawIds: string[];
  vendorId?: string;
  vendorSource?: VendorSource;
  offeringId?: string;
  pricePeriodIds?: string[];
  priceAssumed?: true;
  overrideId?: string;
  billingMode?: BillingMode;
  billingSource?: BillingSource;
  billingPlan?: string;
  requests: number;
  tokens: Tokens;
  costReported: ReportedCost[];
  costComputedUsd?: Decimal;
  costContractUsd?: Decimal;
};

export type SessionSummary = {
  durationMs: number;
  turns: number;
  prompts: number;
  requests: number;
  failedRequests: number;
  retries: number;
  toolCalls: number;
  toolCallsByClass: Record<string, number>;
  mcpServers: string[];
  subagents: { agentId?: string; name: string; requests: number; costUsd?: Decimal }[];
  models: SessionModelSummary[];
  tokens: Tokens;
  costReported: ReportedCost[];
  costComputedUsd?: Decimal;
  costContractUsd?: Decimal;
  costUsd?: Decimal;
  lines: { added: number; removed: number };
  commits: number;
  pullRequests: number;
  errorsByClass: Record<string, number>;
  compactions: number;
};

export type SessionCoverage = {
  hasUsage: boolean;
  hasContext: boolean;
  hasRepo: boolean;
  fullyAttributed: boolean;
  usageSource?: string;
};

export type SessionDocument = {
  _id: string;
  organizationId: string;
  projectId: string;
  instanceId: string;

  origin: 'native' | 'inferred';
  inferKey?: string;
  versions: { summary: number; attribution: number; facts: number };

  client: { family: string; surface?: string; version?: string };
  parentSessionKey?: string;
  rootSessionKey: string;
  continuesSessionKey?: string;

  startedAt: Date;
  lastActivityAt: Date;
  lastObservedAt: Date;
  endedAt?: Date;
  state: 'active' | 'idle' | 'ended';

  observed: {
    userId?: string;
    deviceId?: string;
    agentId?: string;
    clientUserIds: string[];
    clientInstallationIds: string[];
    conflicts?: string[];
  };

  context: {
    workspaceIds: string[];
    repoIds: string[];
    branch?: string;
    head?: string;
    ticketRefs: string[];
    tags: SessionTag[];
    pathStored: boolean;
  };

  manual?: ManualAssignment[];

  attribution?: {
    entries: AttributionEntry[];
    dimIds: string[];
    version: number;
    inputsHash: string;
    computedAt: Date;
  };

  summary?: SessionSummary;
  summaryWatermark?: Date;
  factsComputedAt?: Date;
  settledObservedAt?: Date;
  settlePending?: true;
  frozen?: true;
  coverage?: SessionCoverage;
  classification?: SessionClassification;

  expiresAt: Date;
};

// `<instanceId>:<type>:<value>` maps a correlation id to its session. `orphan:<…same…>` lists
// records that carried the correlation id before any session claimed it; settling links them.
export type SessionLinkDocument = {
  _id: string;
  instanceId: string;
  sessionKey?: string;
  recordIds?: string[];
  expiresAt: Date;
};

export type SliceDim = { kind: string; id: string; w: number };

export type UsageSliceDocument = {
  _id: string;
  organizationId: string;
  projectId: string;
  instanceId: string;
  bucket: Date;
  bucketMinutes: 15 | 1440;
  sessionKey?: string;
  rootSessionKey?: string;
  sessionlessKey?: string;

  userId?: string;
  deviceId?: string;
  agentId?: string;
  subagentId?: string;
  workspaceIds: string[];
  repoIds: string[];
  dims: SliceDim[];
  dimIds: string[];

  client: { family: string; version?: string; surface?: string };
  modelId?: string;
  modelRaw?: string;
  provider?: string;
  vendorId?: string;
  vendorSource?: VendorSource;
  billingMode?: BillingMode;
  billingSource?: BillingSource;
  billingPlan?: string;

  sessionsStarted: 0 | 1;
  turns: number;
  requests: number;
  failedRequests: number;
  toolCalls: number;
  tokens: Tokens;
  costReported: ReportedCost[];
  costComputedUsd?: Decimal;
  costContractUsd?: Decimal;
  costUsd?: Decimal;
  lines: { added: number; removed: number };

  attributionVersion: number;
  factsVersion: number;
  computedAt: Date;
  expiresAt: Date;
};

export type SourceKind =
  | 'hook'
  | 'probe'
  | 'otel.logs'
  | 'otel.spans'
  | 'otel.metrics'
  | 'plugin'
  | 'transcript'
  | 'vendor';

export type SourceHealthDocument = {
  _id: string;
  organizationId: string;
  instanceId: string;
  deviceId?: string;
  userId?: string;
  family: string;
  // Written as `lastSeen.<kind>`, so stored documents nest the dotted otel kinds under `otel`;
  // read through `sourceLastSeen`.
  lastSeen: Partial<Record<SourceKind, Date>> & {
    otel?: { logs?: Date; spans?: Date; metrics?: Date };
  };
  clientVersion?: string;
  probeVersion?: string;
  updatedAt: Date;
};

let schemaOptions = { versionKey: false, autoIndex: false, strict: false } as const;

export let SessionSchema = new mongoose.Schema<SessionDocument>(
  { _id: String, organizationId: String, instanceId: String },
  schemaOptions
);

SessionSchema.index({ organizationId: 1, startedAt: -1 });
SessionSchema.index({ organizationId: 1, 'attribution.dimIds': 1, startedAt: -1 });
SessionSchema.index({ organizationId: 1, rootSessionKey: 1 });
SessionSchema.index({ organizationId: 1, 'observed.userId': 1, startedAt: -1 });
SessionSchema.index({ organizationId: 1, state: 1, lastActivityAt: 1 });
SessionSchema.index({ state: 1, lastActivityAt: 1 });
SessionSchema.index(
  { inferKey: 1, lastActivityAt: -1 },
  { partialFilterExpression: { origin: 'inferred' } }
);
SessionSchema.index(
  { lastActivityAt: 1 },
  { partialFilterExpression: { settlePending: true } }
);
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export let SessionLinkSchema = new mongoose.Schema<SessionLinkDocument>(
  { _id: String },
  schemaOptions
);

SessionLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export let UsageSliceSchema = new mongoose.Schema<UsageSliceDocument>(
  { _id: String, organizationId: String },
  schemaOptions
);

UsageSliceSchema.index({ organizationId: 1, bucket: 1 });
UsageSliceSchema.index({ organizationId: 1, dimIds: 1, bucket: 1 });
UsageSliceSchema.index({ organizationId: 1, modelId: 1, bucket: 1 });
UsageSliceSchema.index({ organizationId: 1, modelRaw: 1, bucket: 1 });
UsageSliceSchema.index({ organizationId: 1, vendorId: 1, bucket: 1 });
UsageSliceSchema.index({ organizationId: 1, billingMode: 1, bucket: 1 });
UsageSliceSchema.index({ organizationId: 1, 'client.family': 1, bucket: 1 });
UsageSliceSchema.index({ organizationId: 1, sessionKey: 1 });
UsageSliceSchema.index(
  { organizationId: 1, sessionlessKey: 1 },
  { partialFilterExpression: { sessionlessKey: { $exists: true } } }
);
UsageSliceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export let SourceHealthSchema = new mongoose.Schema<SourceHealthDocument>(
  { _id: String, organizationId: String },
  schemaOptions
);

SourceHealthSchema.index({ organizationId: 1, instanceId: 1, updatedAt: -1 });
