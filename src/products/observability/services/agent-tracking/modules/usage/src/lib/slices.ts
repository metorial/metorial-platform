import { createHash } from 'node:crypto';
import { entriesToDims } from '@mtsrc/agent-tracking-module-attribution';
import type {
  AttributionEntry,
  SessionDocument,
  UsageSliceDocument
} from '@mtsrc/agent-tracking-store';
import type { BillingMode, BillingSource } from '@mtsrc/agent-tracking-spec';
import type { ReportedCost } from '@mtsrc/agent-tracking-store';
import type { VendorSource } from '@mtsrc/agent-tracking-model-resolver';
import type { Decimal, Tokens } from '@mtsrc/agent-tracking-cost';
import { FACTS_VERSION } from '@mtsrc/agent-tracking-layers';

let dayMs = 24 * 60 * 60 * 1000;

let sessionlessPrefix = 'sessionless:';

export type SliceAttribution = {
  entries: AttributionEntry[];
  dimIds: string[];
  version: number;
};

export let sliceId = (parts: (string | undefined)[]) =>
  createHash('sha256')
    .update(parts.map(part => part ?? '').join('\u0000'))
    .digest('hex')
    .slice(0, 32);

export let sessionlessKey = (instanceId: string, bucket: Date) =>
  `${sessionlessPrefix}${instanceId}:${bucket.toISOString()}`;

export let isSessionlessKey = (key: string) => key.startsWith(sessionlessPrefix);

export let parseSessionlessKey = (key: string) => {
  if (!isSessionlessKey(key)) return null;

  let rest = key.slice(sessionlessPrefix.length);
  let separator = rest.indexOf(':');
  if (separator <= 0) return null;

  let bucket = new Date(rest.slice(separator + 1));
  if (isNaN(bucket.getTime())) return null;

  return { instanceId: rest.slice(0, separator), bucket };
};

let metricsOf = (slice: BaseSlice) => ({
  bucket: slice.bucket,
  bucketMinutes: slice.bucketMinutes,
  subagentId: slice.subagentId,
  modelId: slice.modelId,
  modelRaw: slice.modelRaw,
  provider: slice.provider,
  vendorId: slice.vendorId,
  vendorSource: slice.vendorSource,
  billingMode: slice.billingMode,
  billingSource: slice.billingSource,
  billingPlan: slice.billingPlan,

  sessionsStarted: slice.sessionsStarted,
  turns: slice.turns,
  requests: slice.requests,
  failedRequests: slice.failedRequests,
  toolCalls: slice.toolCalls,
  tokens: slice.tokens,
  costReported: slice.costReported,
  costComputedUsd: slice.costComputedUsd,
  costContractUsd: slice.costContractUsd,
  costUsd: slice.costUsd,
  lines: slice.lines
});

export let baseSliceOf = (slice: UsageSliceDocument): BaseSlice => ({
  ...metricsOf(slice),
  userId: slice.userId,
  deviceId: slice.deviceId,
  agentId: slice.agentId,
  client: slice.client
});

let sliceKeyParts = (slice: BaseSlice) => [
  slice.bucket.toISOString(),
  slice.modelId,
  slice.modelId ? undefined : slice.modelRaw,
  slice.vendorId,
  slice.vendorSource,
  slice.billingMode,
  slice.billingSource,
  slice.billingPlan,
  slice.subagentId
];

export let attributionFields = (attribution: SliceAttribution) => ({
  dims: entriesToDims(attribution.entries),
  dimIds: attribution.dimIds,
  attributionVersion: attribution.version
});

let sessionSliceExpiry = (
  session: Pick<SessionDocument, 'startedAt' | 'expiresAt'>,
  bucket: Date
) =>
  session.expiresAt
    ? new Date(session.expiresAt.getTime() + (bucket.getTime() - session.startedAt.getTime()))
    : new Date(bucket.getTime() + 400 * dayMs);

export let buildSessionSlices = (d: {
  session: SessionDocument;
  attribution: SliceAttribution;
  slices: BaseSlice[];
  now: Date;
}): UsageSliceDocument[] => {
  let { session } = d;

  return d.slices.map(slice => ({
    _id: sliceId([session.instanceId, session._id, ...sliceKeyParts(slice)]),
    organizationId: session.organizationId,
    projectId: session.projectId,
    instanceId: session.instanceId,
    sessionKey: session._id,
    rootSessionKey: session.rootSessionKey,

    userId: session.observed?.userId,
    deviceId: session.observed?.deviceId,
    agentId: session.observed?.agentId,
    workspaceIds: session.context?.workspaceIds ?? [],
    repoIds: session.context?.repoIds ?? [],
    ...attributionFields(d.attribution),

    client: session.client,
    ...metricsOf(slice),

    factsVersion: FACTS_VERSION,
    computedAt: d.now,
    expiresAt: sessionSliceExpiry(session, slice.bucket)
  }));
};

export let buildSessionlessSlices = (d: {
  key: string;
  scope: { organizationId: string; projectId: string; instanceId: string };
  usageRetentionDays: number;
  slices: { slice: BaseSlice; attribution: SliceAttribution }[];
  now: Date;
}): UsageSliceDocument[] =>
  d.slices.map(({ slice, attribution }) => ({
    _id: sliceId([
      d.scope.instanceId,
      d.key,
      ...sliceKeyParts(slice),
      slice.userId,
      slice.deviceId,
      slice.agentId
    ]),
    ...d.scope,
    sessionlessKey: d.key,

    userId: slice.userId,
    deviceId: slice.deviceId,
    agentId: slice.agentId,
    workspaceIds: [],
    repoIds: [],
    ...attributionFields(attribution),

    client: slice.client ?? { family: 'unknown' },
    ...metricsOf(slice),
    sessionsStarted: 0,

    factsVersion: FACTS_VERSION,
    computedAt: d.now,
    expiresAt: new Date(slice.bucket.getTime() + d.usageRetentionDays * dayMs)
  }));

export type BaseSlice = {
  bucket: Date;
  bucketMinutes: 15 | 1440;
  subagentId?: string;
  modelId?: string;
  modelRaw?: string;
  provider?: string;
  vendorId?: string;
  vendorSource?: VendorSource;
  billingMode?: BillingMode;
  billingSource?: BillingSource;
  billingPlan?: string;

  // Sessionless slices only: the observed identity of the aggregate (07 §5.6).
  userId?: string;
  deviceId?: string;
  agentId?: string;
  client?: { family: string; version?: string; surface?: string };

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
};
