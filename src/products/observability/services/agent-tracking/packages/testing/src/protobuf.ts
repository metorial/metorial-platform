export type AnyValue =
  | string
  | number
  | boolean
  | bigint
  | null
  | Uint8Array
  | { double: number }
  | AnyValue[]
  | { [key: string]: AnyValue };

export type Attrs = Record<string, AnyValue>;

export type ResourceDesc = { attributes?: Attrs };

export type ScopeDesc = { name?: string; version?: string; attributes?: Attrs };

export type Group<T> = { resource?: ResourceDesc; scope?: ScopeDesc; items: T[] };

export type LogDesc = {
  timeNs?: bigint;
  observedTimeNs?: bigint;
  severityNumber?: number;
  severityText?: string;
  eventName?: string;
  body?: AnyValue;
  attributes?: Attrs;
  traceId?: string;
  spanId?: string;
};

export type PointDesc = {
  attributes?: Attrs;
  startNs?: bigint;
  timeNs?: bigint;
  asDouble?: number;
  asInt?: bigint | number;
  count?: bigint | number;
  sum?: number;
  min?: number;
  max?: number;
};

export type MetricDesc = {
  name: string;
  unit?: string;
  shape: 'gauge' | 'sum' | 'histogram' | 'exponential_histogram' | 'summary';
  temporality?: 'delta' | 'cumulative' | 'unspecified';
  monotonic?: boolean;
  points: PointDesc[];
};

export type SpanDesc = {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  name?: string;
  kind?: number;
  startNs?: bigint;
  endNs?: bigint;
  attributes?: Attrs;
  events?: { timeNs?: bigint; name?: string; attributes?: Attrs }[];
  status?: { code?: number; message?: string };
};

export let concat = (...parts: Uint8Array[]): Uint8Array => Buffer.concat(parts);

export let varint = (value: bigint | number): Uint8Array => {
  let remaining = BigInt.asUintN(64, BigInt(value));
  let bytes: number[] = [];

  while (remaining >= 0x80n) {
    bytes.push(Number(remaining & 0x7fn) | 0x80);
    remaining >>= 7n;
  }

  bytes.push(Number(remaining));

  return Uint8Array.from(bytes);
};

export let tag = (field: number, wire: number) => varint((field << 3) | wire);

export let lengthDelimited = (field: number, payload: Uint8Array) =>
  concat(tag(field, 2), varint(payload.length), payload);

export let stringField = (field: number, value: string) =>
  lengthDelimited(field, Buffer.from(value, 'utf8'));

export let bytesField = (field: number, hex: string) =>
  lengthDelimited(field, Buffer.from(hex, 'hex'));

export let varintField = (field: number, value: bigint | number | boolean) =>
  concat(tag(field, 0), varint(typeof value == 'boolean' ? (value ? 1 : 0) : value));

export let fixed64Field = (field: number, value: bigint) => {
  let buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt.asUintN(64, value));

  return concat(tag(field, 1), buffer);
};

export let doubleField = (field: number, value: number) => {
  let buffer = Buffer.alloc(8);
  buffer.writeDoubleLE(value);

  return concat(tag(field, 1), buffer);
};

let isRecord = (value: unknown): value is Record<string, AnyValue> =>
  value !== null &&
  typeof value == 'object' &&
  !Array.isArray(value) &&
  !(value instanceof Uint8Array);

export let encodeAnyValue = (value: AnyValue): Uint8Array => {
  if (value === null) return new Uint8Array();
  if (typeof value == 'string') return stringField(1, value);
  if (typeof value == 'boolean') return varintField(2, value);
  if (typeof value == 'bigint') return varintField(3, value);
  if (typeof value == 'number') {
    return Number.isInteger(value) ? varintField(3, value) : doubleField(4, value);
  }

  if (value instanceof Uint8Array) return lengthDelimited(7, value);
  if (Array.isArray(value)) {
    return lengthDelimited(
      5,
      concat(...value.map(item => lengthDelimited(1, encodeAnyValue(item))))
    );
  }

  if ('double' in value && typeof value.double == 'number' && Object.keys(value).length == 1) {
    return doubleField(4, value.double);
  }

  return lengthDelimited(6, concat(...encodeKeyValues(value as Attrs)));
};

export let encodeKeyValue = (key: string, value: AnyValue) =>
  concat(stringField(1, key), lengthDelimited(2, encodeAnyValue(value)));

let encodeKeyValues = (attrs: Attrs) =>
  Object.entries(attrs).map(([key, value]) => lengthDelimited(1, encodeKeyValue(key, value)));

let attributeFields = (field: number, attrs: Attrs = {}) =>
  Object.entries(attrs).map(([key, value]) =>
    lengthDelimited(field, encodeKeyValue(key, value))
  );

let resourceMessage = (resource: ResourceDesc | undefined) =>
  lengthDelimited(1, concat(...attributeFields(1, resource?.attributes)));

let scopeMessage = (scope: ScopeDesc | undefined) =>
  lengthDelimited(
    1,
    concat(
      ...(scope?.name !== undefined ? [stringField(1, scope.name)] : []),
      ...(scope?.version !== undefined ? [stringField(2, scope.version)] : []),
      ...attributeFields(3, scope?.attributes)
    )
  );

let logMessage = (log: LogDesc) =>
  concat(
    ...(log.timeNs !== undefined ? [fixed64Field(1, log.timeNs)] : []),
    ...(log.severityNumber !== undefined ? [varintField(2, log.severityNumber)] : []),
    ...(log.severityText !== undefined ? [stringField(3, log.severityText)] : []),
    ...(log.body !== undefined ? [lengthDelimited(5, encodeAnyValue(log.body))] : []),
    ...attributeFields(6, log.attributes),
    ...(log.traceId ? [bytesField(9, log.traceId)] : []),
    ...(log.spanId ? [bytesField(10, log.spanId)] : []),
    ...(log.observedTimeNs !== undefined ? [fixed64Field(11, log.observedTimeNs)] : []),
    ...(log.eventName !== undefined ? [stringField(12, log.eventName)] : [])
  );

let spanMessage = (span: SpanDesc) =>
  concat(
    ...(span.traceId ? [bytesField(1, span.traceId)] : []),
    ...(span.spanId ? [bytesField(2, span.spanId)] : []),
    ...(span.parentSpanId ? [bytesField(4, span.parentSpanId)] : []),
    ...(span.name !== undefined ? [stringField(5, span.name)] : []),
    ...(span.kind !== undefined ? [varintField(6, span.kind)] : []),
    ...(span.startNs !== undefined ? [fixed64Field(7, span.startNs)] : []),
    ...(span.endNs !== undefined ? [fixed64Field(8, span.endNs)] : []),
    ...attributeFields(9, span.attributes),
    ...(span.events ?? []).map(event =>
      lengthDelimited(
        11,
        concat(
          ...(event.timeNs !== undefined ? [fixed64Field(1, event.timeNs)] : []),
          ...(event.name !== undefined ? [stringField(2, event.name)] : []),
          ...attributeFields(3, event.attributes)
        )
      )
    ),
    ...(span.status
      ? [
          lengthDelimited(
            15,
            concat(
              ...(span.status.message !== undefined
                ? [stringField(2, span.status.message)]
                : []),
              ...(span.status.code !== undefined ? [varintField(3, span.status.code)] : [])
            )
          )
        ]
      : [])
  );

let dataFields = {
  gauge: 5,
  sum: 7,
  histogram: 9,
  exponential_histogram: 10,
  summary: 11
} as const;

let pointLayout = {
  gauge: { attributes: 7, count: 0, sum: 0, min: 0, max: 0 },
  sum: { attributes: 7, count: 0, sum: 0, min: 0, max: 0 },
  histogram: { attributes: 9, count: 4, sum: 5, min: 11, max: 12 },
  exponential_histogram: { attributes: 1, count: 4, sum: 5, min: 12, max: 13 },
  summary: { attributes: 7, count: 4, sum: 5, min: 0, max: 0 }
} as const;

let temporalityNumber = { unspecified: 0, delta: 1, cumulative: 2 } as const;

let pointMessage = (shape: MetricDesc['shape'], point: PointDesc) => {
  let layout = pointLayout[shape];
  let numeric = shape == 'gauge' || shape == 'sum';

  return concat(
    ...attributeFields(layout.attributes, point.attributes),
    ...(point.startNs !== undefined ? [fixed64Field(2, point.startNs)] : []),
    ...(point.timeNs !== undefined ? [fixed64Field(3, point.timeNs)] : []),
    ...(numeric && point.asDouble !== undefined ? [doubleField(4, point.asDouble)] : []),
    ...(numeric && point.asInt !== undefined ? [fixed64Field(6, BigInt(point.asInt))] : []),
    ...(!numeric && point.count !== undefined
      ? [fixed64Field(layout.count, BigInt(point.count))]
      : []),
    ...(!numeric && point.sum !== undefined ? [doubleField(layout.sum, point.sum)] : []),
    ...(layout.min && point.min !== undefined ? [doubleField(layout.min, point.min)] : []),
    ...(layout.max && point.max !== undefined ? [doubleField(layout.max, point.max)] : [])
  );
};

let metricMessage = (metric: MetricDesc) =>
  concat(
    stringField(1, metric.name),
    ...(metric.unit !== undefined ? [stringField(3, metric.unit)] : []),
    lengthDelimited(
      dataFields[metric.shape],
      concat(
        ...metric.points.map(point => lengthDelimited(1, pointMessage(metric.shape, point))),
        ...(metric.shape != 'gauge' && metric.temporality
          ? [varintField(2, temporalityNumber[metric.temporality])]
          : []),
        ...(metric.shape == 'sum' && metric.monotonic !== undefined
          ? [varintField(3, metric.monotonic)]
          : [])
      )
    )
  );

let exportMessage = <T>(
  groups: Group<T>[],
  fields: { resource: number; scope: number; item: number },
  encodeItem: (item: T) => Uint8Array
) =>
  concat(
    ...groups.map(group =>
      lengthDelimited(
        fields.resource,
        concat(
          resourceMessage(group.resource),
          lengthDelimited(
            2,
            concat(
              scopeMessage(group.scope),
              ...group.items.map(item => lengthDelimited(fields.item, encodeItem(item)))
            )
          )
        )
      )
    )
  );

export let encodeLogsRequest = (groups: Group<LogDesc>[]) =>
  exportMessage(groups, { resource: 1, scope: 2, item: 2 }, logMessage);

export let encodeMetricsRequest = (groups: Group<MetricDesc>[]) =>
  exportMessage(groups, { resource: 1, scope: 2, item: 2 }, metricMessage);

export let encodeTracesRequest = (groups: Group<SpanDesc>[]) =>
  exportMessage(groups, { resource: 1, scope: 2, item: 2 }, spanMessage);

type Json = Record<string, unknown>;

export let anyValueJson = (value: AnyValue): Json => {
  if (value === null) return {};
  if (typeof value == 'string') return { stringValue: value };
  if (typeof value == 'boolean') return { boolValue: value };
  if (typeof value == 'bigint') return { intValue: value.toString() };
  if (typeof value == 'number') {
    return Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value };
  }

  if (value instanceof Uint8Array)
    return { bytesValue: Buffer.from(value).toString('base64') };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(anyValueJson) } };

  if ('double' in value && typeof value.double == 'number' && Object.keys(value).length == 1) {
    return { doubleValue: value.double };
  }

  return { kvlistValue: { values: attributesJson(value as Attrs) } };
};

export let attributesJson = (attrs: Attrs = {}) =>
  Object.entries(attrs).map(([key, value]) => ({ key, value: anyValueJson(value) }));

let nanos = (value: bigint | undefined) =>
  value === undefined ? undefined : value.toString();

let strip = (value: Json): Json => {
  for (let key of Object.keys(value)) {
    if (value[key] === undefined) delete value[key];
  }

  return value;
};

let logJson = (log: LogDesc) =>
  strip({
    timeUnixNano: nanos(log.timeNs),
    observedTimeUnixNano: nanos(log.observedTimeNs),
    severityNumber: log.severityNumber,
    severityText: log.severityText,
    eventName: log.eventName,
    body: log.body !== undefined ? anyValueJson(log.body) : undefined,
    attributes: attributesJson(log.attributes),
    traceId: log.traceId,
    spanId: log.spanId
  });

let spanJson = (span: SpanDesc) =>
  strip({
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    name: span.name,
    kind: span.kind,
    startTimeUnixNano: nanos(span.startNs),
    endTimeUnixNano: nanos(span.endNs),
    attributes: attributesJson(span.attributes),
    events: (span.events ?? []).map(event =>
      strip({
        timeUnixNano: nanos(event.timeNs),
        name: event.name,
        attributes: attributesJson(event.attributes)
      })
    ),
    status: span.status
      ? strip({ code: span.status.code, message: span.status.message })
      : undefined
  });

let jsonShapeKeys = {
  gauge: 'gauge',
  sum: 'sum',
  histogram: 'histogram',
  exponential_histogram: 'exponentialHistogram',
  summary: 'summary'
} as const;

let metricJson = (metric: MetricDesc) => {
  let numeric = metric.shape == 'gauge' || metric.shape == 'sum';

  let points = metric.points.map(point =>
    strip({
      attributes: attributesJson(point.attributes),
      startTimeUnixNano: nanos(point.startNs),
      timeUnixNano: nanos(point.timeNs),
      asDouble: numeric ? point.asDouble : undefined,
      asInt: numeric && point.asInt !== undefined ? String(point.asInt) : undefined,
      count: !numeric && point.count !== undefined ? String(point.count) : undefined,
      sum: !numeric ? point.sum : undefined,
      min: point.min,
      max: point.max
    })
  );

  return strip({
    name: metric.name,
    unit: metric.unit,
    [jsonShapeKeys[metric.shape]]: strip({
      dataPoints: points,
      aggregationTemporality:
        metric.shape != 'gauge' && metric.temporality
          ? temporalityNumber[metric.temporality]
          : undefined,
      isMonotonic: metric.shape == 'sum' ? metric.monotonic : undefined
    })
  });
};

let exportJson = <T>(
  groups: Group<T>[],
  names: { resources: string; scopes: string; items: string },
  itemJson: (item: T) => Json
) => ({
  [names.resources]: groups.map(group => ({
    resource: { attributes: attributesJson(group.resource?.attributes) },
    [names.scopes]: [
      {
        scope: strip({
          name: group.scope?.name,
          version: group.scope?.version,
          attributes: attributesJson(group.scope?.attributes)
        }),
        [names.items]: group.items.map(itemJson)
      }
    ]
  }))
});

export let logsJson = (groups: Group<LogDesc>[]) =>
  exportJson(
    groups,
    { resources: 'resourceLogs', scopes: 'scopeLogs', items: 'logRecords' },
    logJson
  );

export let metricsJson = (groups: Group<MetricDesc>[]) =>
  exportJson(
    groups,
    { resources: 'resourceMetrics', scopes: 'scopeMetrics', items: 'metrics' },
    metricJson
  );

export let tracesJson = (groups: Group<SpanDesc>[]) =>
  exportJson(
    groups,
    { resources: 'resourceSpans', scopes: 'scopeSpans', items: 'spans' },
    spanJson
  );

export let jsonBytes = (value: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(value));
