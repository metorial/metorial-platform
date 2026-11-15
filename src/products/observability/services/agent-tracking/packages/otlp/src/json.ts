import { ServiceError, isServiceError } from '@lowerdeck/error';
import {
  OtlpDecodeError,
  otlpLimits,
  type OtlpAttributes,
  type OtlpDecoded,
  type OtlpGroup,
  type OtlpLogRecord,
  type OtlpMetricPoint,
  type OtlpResource,
  type OtlpScope,
  type OtlpSpan,
  type OtlpTemporality,
  type OtlpValue
} from './model';
import {
  countItem,
  emptyAttributes,
  emptyObject,
  int64ToValue,
  newState,
  type DecodeState
} from './util';

type Json = Record<string, unknown>;

let isObject = (value: unknown): value is Json =>
  value !== null && typeof value == 'object' && !Array.isArray(value);

let snake = (name: string) => name.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

let pick = (object: Json, name: string): unknown => {
  let value = object[name];

  return value !== undefined ? value : object[snake(name)];
};

let asString = (value: unknown) => (typeof value == 'string' ? value : '');

let asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

let nanosOf = (value: unknown): bigint => {
  if (typeof value == 'string' && /^\d{1,20}$/.test(value)) return BigInt(value);

  if (typeof value == 'number' && Number.isFinite(value) && value > 0) {
    return BigInt(Math.trunc(value));
  }

  return 0n;
};

let numberOf = (value: unknown): number | undefined => {
  if (typeof value == 'number') return Number.isFinite(value) ? value : undefined;

  if (typeof value == 'string' && value.trim() !== '') {
    let parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

let enumOf = (value: unknown, names: Record<string, number>): number => {
  if (typeof value == 'number' && Number.isFinite(value)) return value;

  if (typeof value == 'string') {
    if (value in names) return names[value]!;

    let parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
};

let severityNames: Record<string, number> = {
  SEVERITY_NUMBER_UNSPECIFIED: 0,
  SEVERITY_NUMBER_TRACE: 1,
  SEVERITY_NUMBER_DEBUG: 5,
  SEVERITY_NUMBER_INFO: 9,
  SEVERITY_NUMBER_WARN: 13,
  SEVERITY_NUMBER_ERROR: 17,
  SEVERITY_NUMBER_FATAL: 21
};

let spanKindNames: Record<string, number> = {
  SPAN_KIND_UNSPECIFIED: 0,
  SPAN_KIND_INTERNAL: 1,
  SPAN_KIND_SERVER: 2,
  SPAN_KIND_CLIENT: 3,
  SPAN_KIND_PRODUCER: 4,
  SPAN_KIND_CONSUMER: 5
};

let statusNames: Record<string, number> = {
  STATUS_CODE_UNSET: 0,
  STATUS_CODE_OK: 1,
  STATUS_CODE_ERROR: 2
};

let temporalityNames: Record<string, number> = {
  AGGREGATION_TEMPORALITY_UNSPECIFIED: 0,
  AGGREGATION_TEMPORALITY_DELTA: 1,
  AGGREGATION_TEMPORALITY_CUMULATIVE: 2
};

let temporalityOf = (value: unknown): OtlpTemporality => {
  let number = enumOf(value, temporalityNames);

  return number == 1 ? 'delta' : number == 2 ? 'cumulative' : 'unspecified';
};

let hexOf = (value: unknown): string => {
  if (typeof value != 'string' || value.length == 0) return '';

  if (/^([0-9a-fA-F]{2})+$/.test(value)) return value.toLowerCase();

  if (/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    let hex = Buffer.from(value, 'base64').toString('hex');
    if (hex.length == 16 || hex.length == 32) return hex;
  }

  return '';
};

let specialNumbers: Record<string, number> = {
  NaN: NaN,
  Infinity: Infinity,
  '-Infinity': -Infinity
};

let decodeValue = (value: unknown, depth: number): OtlpValue => {
  if (depth > otlpLimits.maxDepth) throw new OtlpDecodeError('value nesting too deep');

  if (value === null || value === undefined) return null;
  if (typeof value == 'string' || typeof value == 'boolean') return value;
  if (typeof value == 'number') return Number.isFinite(value) ? value : null;

  if (Array.isArray(value)) {
    return value.slice(0, otlpLimits.maxArrayLength).map(item => decodeValue(item, depth + 1));
  }

  if (!isObject(value)) return null;

  let string = pick(value, 'stringValue');
  if (typeof string == 'string') return string;

  let bool = pick(value, 'boolValue');
  if (typeof bool == 'boolean') return bool;

  let integer = pick(value, 'intValue');
  if (integer !== undefined) {
    if (typeof integer == 'number')
      return Number.isFinite(integer) ? Math.trunc(integer) : null;

    if (typeof integer == 'string' && /^-?\d{1,20}$/.test(integer)) {
      return int64ToValue(BigInt(integer));
    }

    return null;
  }

  let double = pick(value, 'doubleValue');
  if (double !== undefined) {
    if (typeof double == 'number') return Number.isFinite(double) ? double : null;
    if (typeof double == 'string' && double in specialNumbers) return null;

    return numberOf(double) ?? null;
  }

  let array = pick(value, 'arrayValue');
  if (isObject(array)) {
    return asArray(array.values)
      .slice(0, otlpLimits.maxArrayLength)
      .map(item => decodeValue(item, depth + 1));
  }

  let list = pick(value, 'kvlistValue');
  if (isObject(list))
    return decodeAttributes(list.values, depth + 1, otlpLimits.maxArrayLength);

  let bytes = pick(value, 'bytesValue');
  if (typeof bytes == 'string') return bytes;

  let object = emptyObject();
  let count = 0;

  for (let [key, inner] of Object.entries(value)) {
    if (count++ >= otlpLimits.maxArrayLength) break;
    object[key] = decodeValue(inner, depth + 1);
  }

  return object;
};

let decodeAttributes = (
  value: unknown,
  depth = 0,
  limit = otlpLimits.maxAttributesPerItem
): OtlpAttributes => {
  let attributes = emptyAttributes();

  if (Array.isArray(value)) {
    for (let entry of value) {
      if (Object.keys(attributes).length >= limit) break;
      if (!isObject(entry) || typeof entry.key != 'string' || entry.key == '') continue;

      attributes[entry.key] = decodeValue(entry.value, depth);
    }

    return attributes;
  }

  if (isObject(value)) {
    for (let [key, inner] of Object.entries(value)) {
      if (Object.keys(attributes).length >= limit) break;
      attributes[key] = decodeValue(inner, depth);
    }
  }

  return attributes;
};

let decodeResource = (value: unknown): OtlpResource => ({
  attributes: isObject(value) ? decodeAttributes(value.attributes) : emptyAttributes()
});

let decodeScope = (value: unknown): OtlpScope =>
  isObject(value)
    ? {
        name: asString(value.name),
        version: asString(value.version),
        attributes: decodeAttributes(value.attributes)
      }
    : { name: '', version: '', attributes: emptyAttributes() };

let decodeLogRecord = (value: Json): OtlpLogRecord => ({
  timeNs: nanosOf(pick(value, 'timeUnixNano')),
  observedTimeNs: nanosOf(pick(value, 'observedTimeUnixNano')),
  severityNumber: enumOf(pick(value, 'severityNumber'), severityNames),
  severityText: asString(pick(value, 'severityText')),
  eventName: asString(pick(value, 'eventName')),
  body: decodeValue(value.body, 0),
  attributes: decodeAttributes(value.attributes),
  traceId: hexOf(pick(value, 'traceId')),
  spanId: hexOf(pick(value, 'spanId'))
});

let decodeSpan = (value: Json): OtlpSpan => ({
  traceId: hexOf(pick(value, 'traceId')),
  spanId: hexOf(pick(value, 'spanId')),
  parentSpanId: hexOf(pick(value, 'parentSpanId')),
  name: asString(value.name),
  kind: enumOf(value.kind, spanKindNames),
  startNs: nanosOf(pick(value, 'startTimeUnixNano')),
  endNs: nanosOf(pick(value, 'endTimeUnixNano')),
  attributes: decodeAttributes(value.attributes),

  events: asArray(value.events)
    .slice(0, otlpLimits.maxArrayLength)
    .filter(isObject)
    .map(event => ({
      timeNs: nanosOf(pick(event, 'timeUnixNano')),
      name: asString(event.name),
      attributes: decodeAttributes(event.attributes)
    })),

  statusCode: isObject(value.status) ? enumOf(value.status.code, statusNames) : 0,
  statusMessage: isObject(value.status) ? asString(value.status.message) : ''
});

let metricShapes = [
  ['gauge', 'gauge'],
  ['sum', 'sum'],
  ['histogram', 'histogram'],
  ['exponentialHistogram', 'exponential_histogram'],
  ['summary', 'summary']
] as const;

let decodeMetric = (value: Json): OtlpMetricPoint[] => {
  let name = asString(value.name);
  let unit = asString(value.unit);

  for (let [key, shape] of metricShapes) {
    let data = pick(value, key);
    if (!isObject(data)) continue;

    let temporality: OtlpTemporality =
      shape == 'gauge' ? 'unspecified' : temporalityOf(pick(data, 'aggregationTemporality'));
    let monotonic = pick(data, 'isMonotonic') === true;

    return asArray(pick(data, 'dataPoints'))
      .filter(isObject)
      .map(point => {
        let result: OtlpMetricPoint = {
          name,
          unit,
          shape,
          temporality,
          monotonic,
          startNs: nanosOf(pick(point, 'startTimeUnixNano')),
          timeNs: nanosOf(pick(point, 'timeUnixNano')),
          attributes: decodeAttributes(point.attributes),
          value: null
        };

        if (shape == 'gauge' || shape == 'sum') {
          result.value =
            numberOf(pick(point, 'asDouble')) ?? numberOf(pick(point, 'asInt')) ?? null;
        } else {
          let histogram = {
            count: numberOf(point.count) ?? 0,
            sum: numberOf(point.sum),
            min: numberOf(point.min),
            max: numberOf(point.max)
          };

          result.histogram = histogram;
          result.value = histogram.sum ?? null;
        }

        return result;
      });
  }

  return [];
};

let parseJson = (bytes: Uint8Array): Json => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new OtlpDecodeError('invalid json');
  }

  if (!isObject(parsed)) throw new OtlpDecodeError('the body must be a JSON object');

  return parsed;
};

let decodeExport = <T>(
  bytes: Uint8Array,
  names: { resources: string; scopes: string; items: string },
  decodeItem: (value: Json) => T | T[]
): OtlpDecoded<T> => {
  let root = parseJson(bytes);
  let state: DecodeState = newState();
  let groups: OtlpGroup<T>[] = [];

  let resources = pick(root, names.resources);

  if (resources !== undefined && !Array.isArray(resources)) {
    throw new OtlpDecodeError(`${names.resources} must be an array`);
  }

  for (let resourceEntry of asArray(resources)) {
    if (!isObject(resourceEntry)) {
      state.malformed++;
      continue;
    }

    let resource = decodeResource(resourceEntry.resource);

    for (let scopeEntry of asArray(pick(resourceEntry, names.scopes))) {
      if (!isObject(scopeEntry)) {
        state.malformed++;
        continue;
      }

      let items: T[] = [];

      for (let itemEntry of asArray(pick(scopeEntry, names.items))) {
        if (!isObject(itemEntry)) {
          state.malformed++;
          continue;
        }

        let decoded: T | T[];

        try {
          decoded = decodeItem(itemEntry);
        } catch (error) {
          if (isServiceError(error) || error instanceof ServiceError) throw error;
          if (!(error instanceof OtlpDecodeError)) throw error;

          state.malformed++;
          continue;
        }

        for (let item of Array.isArray(decoded) ? decoded : [decoded]) {
          countItem(state);
          items.push(item);
        }
      }

      groups.push({ resource, scope: decodeScope(scopeEntry.scope), items });
    }
  }

  return { groups, itemCount: state.itemCount, malformed: state.malformed };
};

export let decodeLogsJson = (bytes: Uint8Array) =>
  decodeExport(
    bytes,
    { resources: 'resourceLogs', scopes: 'scopeLogs', items: 'logRecords' },
    decodeLogRecord
  );

export let decodeTracesJson = (bytes: Uint8Array) =>
  decodeExport(
    bytes,
    { resources: 'resourceSpans', scopes: 'scopeSpans', items: 'spans' },
    decodeSpan
  );

export let decodeMetricsJson = (bytes: Uint8Array) =>
  decodeExport(
    bytes,
    { resources: 'resourceMetrics', scopes: 'scopeMetrics', items: 'metrics' },
    decodeMetric
  );
