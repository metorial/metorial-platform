import type {
  ContentMode,
  ContentRole,
  ContentState,
  CredentialKind,
  ExtraValue,
  IngestChannel,
  RecordRole,
  SessionOrigin
} from '@mtsrc/agent-tracking-spec';
import mongoose from 'mongoose';

export type StoredContentEntry = {
  role: ContentRole;
  mode: ContentMode;
  state: ContentState;

  length?: { chars: number; bytes?: number; source: 'measured' | 'client_reported' };
  hash?: { alg: 'hmac-sha256-128'; value: string; basis: 'full' | 'truncated' };
  shape?: Record<string, unknown>;

  truncated?: boolean;
  originalLength?: number;
  hasText?: true;
};

export type StoredExtra = { k: string; v: ExtraValue };

export type StoredAttribution = {
  userId?: string;
  deviceId?: string;
  agentId?: string;
  clientUserId?: string;
  clientInstallationId?: string;
  repoId?: string;
  workspaceId?: string;
};

export type RecordDocument = {
  _id: string;
  organizationId: string;
  projectId: string;
  instanceId: string;
  spec: string;
  type: string;

  occurredAt: Date;
  observedAt: Date;
  durationMs?: number;
  expiresAt: Date;

  ingest: {
    credentialKind: CredentialKind;
    credentialId: string;
    route: string;
    requestId: string;
    backfill: boolean;
    batchId?: string;
    agent?: { name: string; version: string; installId: string };
  };

  source: {
    adapter: string;
    dialect: string;
    channel: IngestChannel;
    signalName?: string;
    role: RecordRole;
    factKey?: string;
    nativeVersion?: string;
  };

  client: {
    family: string;
    surface?: string;
    version?: string;
    authMode?: string;
    terminal?: string;
  };

  actor?: {
    installId?: string;
    user?: { id?: string; email?: string };
    orgClaim?: string;
    identitySource: 'client_claim' | 'credential' | 'resource_attribute';
  };

  attribution?: StoredAttribution;

  ctx: {
    sessionId?: string;
    sessionKey?: string;
    sessionOrigin?: SessionOrigin;
    parentSessionKey?: string;
    continuesSessionKey?: string;
    turnId?: string;
    requestId?: string;
    generationId?: string;
    toolCallId?: string;
    agent?: { id?: string; parentId?: string };
    trace?: { traceId?: string; spanId?: string; parentSpanId?: string };
  };

  workspace?: { os?: string; hostHash?: string };

  data: Record<string, unknown>;
  content?: StoredContentEntry[];
  extras?: StoredExtra[];

  quality: {
    coerced?: string[];
    derived?: string[];
    dropped?: string[];
    warnings?: string[];
    timeSource: 'client' | 'agent_observed' | 'observed';
  };
};

export type ContentTextDocument = {
  _id: string;
  organizationId: string;
  projectId: string;
  instanceId: string;
  recordId: string;
  index: number;
  role: ContentRole;

  keyVersion: number;
  iv: mongoose.mongo.Binary;
  ciphertext: mongoose.mongo.Binary;

  occurredAt: Date;
  expiresAt: Date;
};

let schemaOptions = { versionKey: false, autoIndex: false, strict: false } as const;

let Mixed = mongoose.Schema.Types.Mixed;

let recordSchemaDefinition = {
  _id: String,
  organizationId: String,
  projectId: String,
  instanceId: String,
  spec: String,
  type: String,

  occurredAt: Date,
  observedAt: Date,
  durationMs: Number,
  expiresAt: Date,

  ingest: Mixed,
  source: Mixed,
  client: Mixed,
  actor: Mixed,
  attribution: Mixed,
  ctx: Mixed,
  workspace: Mixed,

  data: Mixed,
  content: Mixed,
  extras: Mixed,
  quality: Mixed
};

export let EventSchema = new mongoose.Schema<RecordDocument>(
  recordSchemaDefinition,
  schemaOptions
);

EventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
EventSchema.index({ organizationId: 1, occurredAt: -1 });
EventSchema.index({ organizationId: 1, instanceId: 1, occurredAt: -1 });
EventSchema.index(
  { organizationId: 1, 'ctx.sessionKey': 1, occurredAt: 1 },
  { partialFilterExpression: { 'ctx.sessionKey': { $exists: true } } }
);
EventSchema.index(
  { organizationId: 1, 'source.factKey': 1 },
  { partialFilterExpression: { 'source.factKey': { $exists: true } } }
);
EventSchema.index(
  { organizationId: 1, 'attribution.userId': 1, occurredAt: -1 },
  { partialFilterExpression: { 'attribution.userId': { $exists: true } } }
);

export let MeasurementSchema = new mongoose.Schema<RecordDocument>(
  recordSchemaDefinition,
  schemaOptions
);

MeasurementSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
MeasurementSchema.index({ organizationId: 1, type: 1, occurredAt: -1 });
MeasurementSchema.index({ organizationId: 1, instanceId: 1, occurredAt: -1 });
MeasurementSchema.index(
  { organizationId: 1, 'attribution.userId': 1, occurredAt: -1 },
  { partialFilterExpression: { 'attribution.userId': { $exists: true } } }
);

export let ContentTextSchema = new mongoose.Schema<ContentTextDocument>(
  {
    _id: String,
    organizationId: String,
    projectId: String,
    instanceId: String,
    recordId: String,
    index: Number,
    role: String,

    keyVersion: Number,
    iv: Buffer,
    ciphertext: Buffer,

    occurredAt: Date,
    expiresAt: Date
  },
  schemaOptions
);

ContentTextSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
ContentTextSchema.index({ organizationId: 1, expiresAt: 1 });
ContentTextSchema.index({ organizationId: 1, instanceId: 1 });

export let collectionNames = {
  events: 'events',
  measurements: 'measurements',
  contentTexts: 'content_texts'
} as const;

export type StoreCollection = keyof typeof collectionNames;
