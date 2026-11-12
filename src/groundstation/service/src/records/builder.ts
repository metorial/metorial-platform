import {
  recordSpecVersion,
  type ContentEntry,
  type NormalizedRecord,
  type RecordLane
} from '@metorial/groundstation-spec';
import { buildContentEntry } from '../content/engine';
import { recordId, sessionKey, type TenantKey } from '../crypto/keys';
import type { IngestPrincipal } from '../auth/principal';
import type { RecordDraft, RecordSource } from './draft';
import { sanitizeExtras } from './extras';

let maxIdLength = 256;
let maxLabelLength = 128;
let minPlausibleTime = Date.UTC(2015, 0, 1);
let maxPlausibleTime = Date.UTC(2100, 0, 1);

export type BuildContext = {
  principal: IngestPrincipal;
  tenantKey: TenantKey;

  requestId: string;
  route: NormalizedRecord['ingest']['route'];
  observedAt: Date;
  lane: RecordLane;

  batchId?: string;
  agent?: NormalizedRecord['ingest']['agent'];

  arrivalIsEventTime?: boolean;
  itemObservedAt?: Date | null;
};

export let isPlausibleTime = (date: Date | null | undefined): date is Date => {
  if (!date) return false;

  let time = date.getTime();

  return Number.isFinite(time) && time >= minPlausibleTime && time < maxPlausibleTime;
};

export let safeLabel = (value: unknown, fallback = 'unknown'): string => {
  if (typeof value != 'string') return fallback;

  let trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLabelLength) return fallback;

  return /^[A-Za-z0-9_.:/@+ -]+$/.test(trimmed) ? trimmed : fallback;
};

let clampId = (value: string | undefined, label: string, warnings: string[]) => {
  if (value === undefined || value === '') return undefined;
  if (value.length <= maxIdLength) return value;

  warnings.push(`truncated:${label}`);

  return value.slice(0, maxIdLength);
};

let compact = <T extends Record<string, unknown>>(value: T): T => {
  for (let key of Object.keys(value)) {
    if (value[key] === undefined) delete value[key];
  }

  return value;
};

export let buildRecord = (
  context: BuildContext,
  source: RecordSource,
  draft: RecordDraft
): NormalizedRecord => {
  let { principal, tenantKey } = context;

  let coerced = [...(draft.coerced ?? [])];
  let derived = [...(draft.derived ?? [])];
  let dropped = [...(draft.dropped ?? [])];
  let warnings = [...(draft.warnings ?? [])];

  let occurredAt: Date;
  let timeSource: NormalizedRecord['quality']['time_source'];

  if (isPlausibleTime(draft.occurredAt)) {
    occurredAt = draft.occurredAt;
    timeSource = 'client';
  } else if (isPlausibleTime(context.itemObservedAt)) {
    occurredAt = context.itemObservedAt;
    timeSource = 'agent_observed';

    if (draft.occurredAt) {
      dropped.push('occurred_at');
      warnings.push('invalid_time');
    }
  } else {
    occurredAt = context.observedAt;
    timeSource = 'observed';

    if (draft.occurredAt) {
      dropped.push('occurred_at');
      warnings.push('invalid_time');
    } else if (!context.arrivalIsEventTime) {
      warnings.push('time_unknown');
    }
  }

  if (
    timeSource != 'observed' &&
    context.lane != 'backfill' &&
    Math.abs(occurredAt.getTime() - context.observedAt.getTime()) >
      principal.tenant.skewBoundSeconds * 1000
  ) {
    warnings.push('clock_skew');
  }

  let content: ContentEntry[] = [];

  for (let input of draft.content ?? []) {
    let entry = buildContentEntry({ policy: principal.contentPolicy, tenantKey }, input);
    if (entry) content.push(entry);
  }

  let { extras, dropped: droppedExtras } = sanitizeExtras(draft.client.family, draft.extras);
  dropped.push(...droppedExtras);

  let sessionId = clampId(draft.ctx?.sessionId, 'ctx.session_id', warnings);

  let ctx: NormalizedRecord['ctx'] = compact({
    session_id: sessionId,
    session_key: sessionId ? sessionKey(tenantKey, draft.client.family, sessionId) : undefined,
    turn_id: clampId(draft.ctx?.turnId, 'ctx.turn_id', warnings),
    request_id: clampId(draft.ctx?.requestId, 'ctx.request_id', warnings),
    tool_call_id: clampId(draft.ctx?.toolCallId, 'ctx.tool_call_id', warnings),

    agent: draft.ctx?.agent
      ? compact({
          id: clampId(draft.ctx.agent.id, 'ctx.agent.id', warnings),
          parent_id: clampId(draft.ctx.agent.parentId, 'ctx.agent.parent_id', warnings)
        })
      : undefined,

    trace: draft.ctx?.trace
      ? compact({
          trace_id: draft.ctx.trace.traceId,
          span_id: draft.ctx.trace.spanId,
          parent_span_id: draft.ctx.trace.parentSpanId
        })
      : undefined
  });

  let factKey = draft.factKey ?? null;
  if (factKey && factKey.includes('{session_key}')) {
    factKey = ctx.session_key ? factKey.replace('{session_key}', ctx.session_key) : null;
  }

  return {
    spec: recordSpecVersion,
    id: recordId(tenantKey, `${source.adapter}/${source.channel}`, draft.identity),
    kind: draft.kind,
    type: draft.type,

    occurred_at: occurredAt.toISOString(),
    ...(draft.durationMs !== undefined && Number.isFinite(draft.durationMs)
      ? { duration_ms: Math.max(0, Math.round(draft.durationMs)) }
      : {}),
    observed_at: context.observedAt.toISOString(),

    ingest: compact({
      tenant_id: principal.tenant.id,
      credential_id: principal.tokenId,
      route: context.route,
      request_id: context.requestId,
      backfill: context.lane == 'backfill',
      batch_id: context.batchId,
      principal: principal.principalRef ? { ref: principal.principalRef } : null,
      agent: context.agent
    }),

    source: compact({
      adapter: source.adapter,
      dialect: source.dialect,
      channel: source.channel,
      signal_name: draft.signalName,
      role: draft.role ?? 'primary',
      fact_key: factKey,
      native_version: draft.nativeVersion
    }),

    client: compact({ ...draft.client }),
    ...(draft.actor ? { actor: compact({ ...draft.actor }) } : {}),
    ctx,
    ...(draft.workspace ? { workspace: compact({ ...draft.workspace }) } : {}),

    data: draft.data ?? {},
    content,
    extras,

    quality: { coerced, derived, dropped, warnings, time_source: timeSource }
  };
};
