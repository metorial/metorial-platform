import {
  recordSpecVersion,
  type ContentEntry,
  type NormalizedRecord,
  type RecordLane
} from '@mtsrc/agent-tracking-spec';
import { buildContentEntry } from '@mtsrc/agent-tracking-content';
import { finishSessionContext, sessionContextType } from './context/record';
import { recordId, sessionKey, type OrganizationKey } from '@mtsrc/agent-tracking-crypto';
import type { IngestPrincipal } from './principal';
import type { RecordDraft, RecordSource } from './draft';
import { sanitizeExtras } from './extras';

export let maxIdLength = 256;
let maxEmailLength = 254;
let maxLabelLength = 128;
let minPlausibleTime = Date.UTC(2015, 0, 1);
let maxPlausibleTime = Date.UTC(2100, 0, 1);

export type BuildContext = {
  principal: IngestPrincipal;
  organizationKey: OrganizationKey;

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

// A shortened email would be another address, which identity resolution could match, so an
// overlong one is dropped instead.
let boundEmail = (value: string | undefined, dropped: string[]) => {
  if (value === undefined || value.length <= maxEmailLength) return value;

  dropped.push('actor.user.email');

  return undefined;
};

let clampModel = (data: Record<string, unknown>, warnings: string[]) => {
  let model = data.model;

  if (typeof model == 'string') {
    return { ...data, model: clampId(model, 'data.model', warnings) };
  }
  if (model && typeof model == 'object' && typeof (model as { id?: unknown }).id == 'string') {
    let id = (model as { id: string }).id;
    if (id.length <= maxIdLength) return data;

    return { ...data, model: { ...model, id: clampId(id, 'data.model.id', warnings) } };
  }

  return data;
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
  let { principal, organizationKey } = context;

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
      principal.instance.skewBoundSeconds * 1000
  ) {
    warnings.push('clock_skew');
  }

  let content: ContentEntry[] = [];

  for (let input of draft.content ?? []) {
    let entry = buildContentEntry({ policy: principal.contentPolicy, organizationKey }, input);
    if (entry) content.push(entry);
  }

  let { extras, dropped: droppedExtras } = sanitizeExtras(draft.client.family, draft.extras);
  dropped.push(...droppedExtras);

  let keyOf = (id: string | undefined) =>
    id
      ? sessionKey(organizationKey, principal.instance.id, draft.client.family, id)
      : undefined;

  let sessionId = clampId(draft.ctx?.sessionId, 'ctx.session_id', warnings);
  let parentSessionId = clampId(draft.ctx?.parentSessionId, 'ctx.parent_session_id', warnings);
  let previousSessionId = clampId(
    draft.ctx?.previousSessionId,
    'ctx.previous_session_id',
    warnings
  );

  let ctx: NormalizedRecord['ctx'] = compact({
    session_id: sessionId,
    session_key: keyOf(sessionId),
    parent_session_key: parentSessionId != sessionId ? keyOf(parentSessionId) : undefined,
    continues_session_key:
      previousSessionId != sessionId ? keyOf(previousSessionId) : undefined,
    turn_id: clampId(draft.ctx?.turnId, 'ctx.turn_id', warnings),
    request_id: clampId(draft.ctx?.requestId, 'ctx.request_id', warnings),
    generation_id: clampId(draft.ctx?.generationId, 'ctx.generation_id', warnings),
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

  let data = clampModel(draft.data ?? {}, warnings);

  let client = compact({
    ...draft.client,
    surface: clampId(draft.client.surface, 'client.surface', warnings),
    version: clampId(draft.client.version, 'client.version', warnings),
    auth_mode: clampId(draft.client.auth_mode, 'client.auth_mode', warnings),
    terminal: clampId(draft.client.terminal, 'client.terminal', warnings)
  });

  let user = draft.actor?.user
    ? compact({
        id: clampId(draft.actor.user.id, 'actor.user.id', warnings),
        email: boundEmail(draft.actor.user.email, dropped)
      })
    : undefined;

  let actor = draft.actor
    ? compact({
        ...draft.actor,
        install_id: clampId(draft.actor.install_id, 'actor.install_id', warnings),
        org_claim: clampId(draft.actor.org_claim, 'actor.org_claim', warnings),
        user: user && Object.keys(user).length ? user : undefined
      })
    : undefined;

  let agent = context.agent
    ? {
        name: clampId(context.agent.name, 'ingest.agent.name', warnings) ?? '',
        version: clampId(context.agent.version, 'ingest.agent.version', warnings) ?? '',
        install_id:
          clampId(context.agent.install_id, 'ingest.agent.install_id', warnings) ?? ''
      }
    : undefined;

  if (draft.type == sessionContextType) {
    let context = finishSessionContext({
      organizationKey,
      rootScope: principal.binding.deviceId ?? principal.credential.id,
      sessionKey: ctx.session_key,
      content: draft.content,
      data
    });

    data = context.data;
    factKey = context.factKey;
  }

  return {
    spec: recordSpecVersion,
    id: recordId(
      organizationKey,
      principal.instance.id,
      `${source.adapter}/${source.channel}`,
      draft.identity
    ),
    kind: draft.kind,
    type: draft.type,

    occurred_at: occurredAt.toISOString(),
    ...(draft.durationMs !== undefined && Number.isFinite(draft.durationMs)
      ? { duration_ms: Math.max(0, Math.round(draft.durationMs)) }
      : {}),
    observed_at: context.observedAt.toISOString(),

    ingest: compact({
      organization_id: principal.organization.id,
      project_id: principal.project.id,
      instance_id: principal.instance.id,
      credential_kind: principal.credential.kind,
      credential_id: principal.credential.id,
      route: context.route,
      request_id: context.requestId,
      backfill: context.lane == 'backfill',
      batch_id: context.batchId,
      agent
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

    client,
    ...(actor ? { actor } : {}),
    ctx,
    ...(draft.workspace ? { workspace: compact({ ...draft.workspace }) } : {}),

    data,
    content,
    extras,

    quality: { coerced, derived, dropped, warnings, time_source: timeSource }
  };
};
