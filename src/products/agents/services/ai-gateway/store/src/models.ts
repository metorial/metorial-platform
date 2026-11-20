import type {
  ConnectionCheckOutcome,
  GatewayCost,
  GatewayUsage,
  PricingSource
} from '@mtsrc/ai-gateway-spec';
import mongoose from 'mongoose';

export let collectionNames = {
  inferenceLogs: 'inference_logs',
  inferenceContents: 'inference_contents',
  connectionChecks: 'connection_checks'
} as const;

export type InferenceDialect = 'openai_chat' | 'anthropic_messages' | 'open_responses';

export type InferenceOperation = 'generate' | 'stream' | 'embed' | 'count_tokens';

export type InferenceStatus = 'succeeded' | 'failed' | 'cancelled';

export type ConnectionRef =
  | { connectionOwner: 'customer'; connectionId: string }
  | { connectionOwner: 'platform'; platformConnectionSlug: string };

export type InferenceError = {
  code: string;
  message: string;
  httpStatus?: number;
  providerCode?: string;
};

export type InferenceAttempt = ConnectionRef & {
  providerSlug: string;
  offeringId: string;
  vendorModelId: string;
  startedAt: Date;
  durationMs: number;
  outcome: 'succeeded' | 'failed' | 'cancelled';
  error?: InferenceError;
};

export type InferenceDecisionLog = {
  model: string;
  source: 'customer' | 'platform' | null;
  cached: boolean;
  latencyMs: number;
  inputTokens: number;
  costUsd: number;
  signals: Record<string, unknown> | null;
  error: { code: string; message: string } | null;
};

export type InferenceVirtualModelLog = {
  id: string;
  slug: string;
  versionId: string;
  versionNumber: number;
  ruleId: string | null;
  reason: 'rule' | 'default' | 'sticky';
  trace: { ruleId: string; outcome: string; error?: string }[];
  targets: string[];
  skippedTargets: { model: string; reason: string }[];
  decision: InferenceDecisionLog | null;
};

export type InferenceLogDocument = {
  _id: string;
  organizationId: string;
  projectId: string;
  instanceId: string;
  tokenId: string;
  consumerRef?: string;

  dialect: InferenceDialect;
  operation: InferenceOperation;
  requestId?: string;

  requestedModel: string;
  model?: { id: string; slug: string; labSlug: string };
  virtualModel?: InferenceVirtualModelLog;
  metadata?: Record<string, string>;

  route?: ConnectionRef & {
    providerSlug: string;
    offeringId: string;
    vendorModelId: string;
    routingRuleSlug?: string;
  };

  attempts: InferenceAttempt[];

  status: InferenceStatus;
  finishReason?: string;
  error?: InferenceError;

  usage?: GatewayUsage;

  // For platform routes `billedCost` is what the customer pays (the routing rule's price or the
  // underlying offering's), while `providerCost` is what the underlying provider charges us.
  billedCost?: GatewayCost & { pricingSource: PricingSource };
  providerCost?: GatewayCost;

  timing: {
    receivedAt: Date;
    upstreamStartedAt?: Date;
    firstTokenAt?: Date;
    completedAt: Date;
    totalMs: number;
    upstreamMs?: number;
    timeToFirstTokenMs?: number;
  };

  request: {
    messageCount?: number;
    toolCount?: number;
    maxOutputTokens?: number;
    userAgent?: string;
  };

  hasContent: boolean;
  expiresAt: Date;
};

export type InferenceContentDocument = {
  _id: string;
  organizationId: string;
  instanceId: string;

  request: unknown;
  response?: unknown;

  createdAt: Date;
  expiresAt: Date;
};

export type ConnectionCheckDocument = {
  _id: string;
  connectionId: string;
  providerSlug: string;
  organizationId?: string;
  instanceId?: string;

  trigger: 'created' | 'updated' | 'scheduled' | 'manual' | 'inference_auth_failure';
  outcome: ConnectionCheckOutcome;
  message?: string;
  httpStatus?: number;
  modelCount?: number;

  checkedAt: Date;
  durationMs: number;
  expiresAt: Date;
};

let schemaOptions = { versionKey: false, autoIndex: false, strict: false } as const;

let Mixed = mongoose.Schema.Types.Mixed;

export let InferenceLogSchema = new mongoose.Schema<InferenceLogDocument>(
  {
    _id: String,
    organizationId: String,
    projectId: String,
    instanceId: String,
    tokenId: String,
    consumerRef: String,

    dialect: String,
    operation: String,
    requestId: String,

    requestedModel: String,
    model: Mixed,
    virtualModel: Mixed,
    metadata: Mixed,
    route: Mixed,
    attempts: Mixed,

    status: String,
    finishReason: String,
    error: Mixed,

    usage: Mixed,
    billedCost: Mixed,
    providerCost: Mixed,

    timing: Mixed,
    request: Mixed,

    hasContent: Boolean,
    expiresAt: Date
  },
  schemaOptions
);

InferenceLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
InferenceLogSchema.index({ organizationId: 1, 'timing.receivedAt': -1 });
InferenceLogSchema.index({ instanceId: 1, 'timing.receivedAt': -1 });
InferenceLogSchema.index({ instanceId: 1, 'model.slug': 1, 'timing.receivedAt': -1 });
InferenceLogSchema.index({ instanceId: 1, 'virtualModel.id': 1, 'timing.receivedAt': -1 });
InferenceLogSchema.index({ tokenId: 1, 'timing.receivedAt': -1 });
InferenceLogSchema.index({ 'route.connectionId': 1, 'timing.receivedAt': -1 });

export let InferenceContentSchema = new mongoose.Schema<InferenceContentDocument>(
  {
    _id: String,
    organizationId: String,
    instanceId: String,

    request: Mixed,
    response: Mixed,

    createdAt: Date,
    expiresAt: Date
  },
  schemaOptions
);

InferenceContentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
InferenceContentSchema.index({ instanceId: 1, createdAt: -1 });

export let ConnectionCheckSchema = new mongoose.Schema<ConnectionCheckDocument>(
  {
    _id: String,
    connectionId: String,
    providerSlug: String,
    organizationId: String,
    instanceId: String,

    trigger: String,
    outcome: String,
    message: String,
    httpStatus: Number,
    modelCount: Number,

    checkedAt: Date,
    durationMs: Number,
    expiresAt: Date
  },
  schemaOptions
);

ConnectionCheckSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
ConnectionCheckSchema.index({ connectionId: 1, checkedAt: -1 });
