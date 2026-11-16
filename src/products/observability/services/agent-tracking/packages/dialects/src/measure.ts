import type { MeasurementType } from '@mtsrc/agent-tracking-spec';
import type { OtlpAttributes, OtlpMetricPoint } from '@mtsrc/agent-tracking-otlp';
import type { RecordDraft } from '@mtsrc/agent-tracking-records-model';
import { actorOf, attributeFingerprint, safeNativeName } from './otlp/common';
import { readFields } from './fields';
import { dateFromNanos } from './time';
import type { OtlpGroupContext } from './types';

let maxDroppedNames = 8;

export let allowedDims = new Set([
  'model',
  'provider',
  'token_type',
  'outcome',
  'decision',
  'tool_class',
  'tool_name',
  'tool_kind',
  'agent_name',
  'purpose',
  'client_surface',
  'language',
  'edit_source',
  'line_op',
  'subscription_tier',
  'type'
]);

let ignoredAttributes = new Set([
  'session.id',
  'prompt.id',
  'user.id',
  'user.email',
  'user.account_id',
  'user.account_uuid',
  'organization.id',
  'terminal.type',
  'app.version',
  'conversation.id',
  'thread.id',
  'anthropic.provider',
  'anthropic.plan',
  'anthropic.seat_type'
]);

export type MeasurementSpec = {
  type: MeasurementType;
  unit: string;
  dims?: Record<string, string | undefined>;
  covers?: string[];
  scale?: number;
  usedAttributes?: string[];
  warnings?: string[];
  client: RecordDraft['client'];
  nativeVersion?: string;
};

export let cleanDims = (dims: Record<string, string | undefined>) => {
  let result: Record<string, string> = {};
  let dropped: string[] = [];

  for (let [key, value] of Object.entries(dims)) {
    if (value === undefined || value === '') continue;

    if (!allowedDims.has(key)) {
      dropped.push(`dim:${key}`);
      continue;
    }

    result[key] = value.length > 64 ? value.slice(0, 64) : value;
  }

  return { dims: result, dropped };
};

export let droppedAttributes = (attributes: OtlpAttributes, used: Iterable<string>) => {
  let usedSet = new Set(used);
  let names: string[] = [];

  for (let key of Object.keys(attributes)) {
    if (usedSet.has(key) || ignoredAttributes.has(key)) continue;

    names.push(`attr:${safeNativeName(key)}`);
    if (names.length >= maxDroppedNames) break;
  }

  return names;
};

export let measurementDraft = (
  context: OtlpGroupContext,
  point: OtlpMetricPoint,
  spec: MeasurementSpec
): RecordDraft | null => {
  let histogram = point.histogram;
  let raw = point.value ?? histogram?.sum ?? null;

  if (raw === null || !Number.isFinite(raw)) return null;

  let scale = spec.scale ?? 1;
  let scaled = raw * scale;

  let { dims, dropped: droppedDims } = cleanDims(spec.dims ?? {});

  let aggregation =
    point.shape == 'gauge'
      ? 'gauge'
      : point.shape == 'sum'
        ? point.temporality == 'cumulative'
          ? 'cumulative'
          : 'delta'
        : 'histogram';

  let start = dateFromNanos(point.startNs);
  let end = dateFromNanos(point.timeNs);

  let attributes = readFields(point.attributes, 'metric.');
  let actor = actorOf(attributes, context.resourceFields);

  return {
    kind: 'measurement',
    type: spec.type,
    identity: [
      'metric',
      point.name,
      context.resourceFingerprint,
      attributeFingerprint(point.attributes),
      String(point.startNs),
      String(point.timeNs)
    ].join('|'),
    signalName: safeNativeName(point.name),
    nativeVersion: spec.nativeVersion,
    occurredAt: end,
    client: spec.client,
    ...(actor ? { actor } : {}),
    ctx: { sessionId: attributes.str('session.id') },
    data: {
      name: spec.type,
      value: scaled,
      unit: spec.unit,
      aggregation,
      ...(aggregation == 'histogram' ? { temporality: point.temporality } : {}),
      window: { start: start?.toISOString() ?? null, end: end?.toISOString() ?? null },
      ...(histogram
        ? {
            histogram: {
              count: histogram.count,
              sum: (histogram.sum ?? 0) * scale,
              ...(histogram.min !== undefined ? { min: histogram.min * scale } : {}),
              ...(histogram.max !== undefined ? { max: histogram.max * scale } : {})
            }
          }
        : {}),
      dims,
      ...(spec.covers ? { covers: spec.covers } : {})
    },
    coerced: attributes.coerced,
    warnings: spec.warnings,
    dropped: [
      ...droppedDims,
      ...droppedAttributes(point.attributes, spec.usedAttributes ?? [])
    ]
  };
};
