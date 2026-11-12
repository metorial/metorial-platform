import type {
  OtlpAttributes,
  OtlpGroup,
  OtlpLogRecord,
  OtlpMetricPoint,
  OtlpSpan,
  OtlpValue
} from '../otlp/model';

export let nanosOf = (iso: string) => BigInt(Date.parse(iso)) * 1_000_000n;

export let otlpAt = '2026-06-15T11:59:30.000Z';

export let logRecord = (
  attributes: OtlpAttributes = {},
  overrides: Partial<OtlpLogRecord> = {}
): OtlpLogRecord => ({
  timeNs: nanosOf(otlpAt),
  observedTimeNs: 0n,
  severityNumber: 9,
  severityText: 'INFO',
  eventName: '',
  body: '',
  attributes,
  traceId: '',
  spanId: '',
  ...overrides
});

export let metricPoint = (
  name: string,
  value: number | null,
  attributes: OtlpAttributes = {},
  overrides: Partial<OtlpMetricPoint> = {}
): OtlpMetricPoint => ({
  name,
  unit: '',
  shape: 'sum',
  temporality: 'delta',
  monotonic: true,
  startNs: nanosOf('2026-06-15T11:59:00.000Z'),
  timeNs: nanosOf(otlpAt),
  attributes,
  value,
  ...overrides
});

export let spanOf = (
  name: string,
  attributes: OtlpAttributes = {},
  overrides: Partial<OtlpSpan> = {}
): OtlpSpan => ({
  traceId: '0af7651916cd43dd8448eb211c80319c',
  spanId: 'b7ad6b7169203331',
  parentSpanId: '',
  name,
  kind: 1,
  startNs: nanosOf('2026-06-15T11:59:28.000Z'),
  endNs: nanosOf(otlpAt),
  attributes,
  events: [],
  statusCode: 0,
  statusMessage: '',
  ...overrides
});

export let groupOf = <T>(
  items: T[],
  resource: OtlpAttributes = {},
  scope: { name?: string; version?: string; attributes?: OtlpAttributes } = {}
): OtlpGroup<T> => ({
  resource: { attributes: resource },
  scope: {
    name: scope.name ?? '',
    version: scope.version ?? '',
    attributes: scope.attributes ?? {}
  },
  items
});

export type { OtlpValue };
