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
import { Reader } from './reader';
import {
  countItem,
  emptyAttributes,
  emptyObject,
  int64ToValue,
  newState,
  type DecodeState
} from './util';

let toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

let decodeAnyValue = (r: Reader, depth: number): OtlpValue => {
  if (depth > otlpLimits.maxDepth) throw new OtlpDecodeError('value nesting too deep');

  let value: OtlpValue = null;

  while (r.next()) {
    switch (r.field) {
      case 1:
        r.expect(2);
        value = r.string();
        break;

      case 2:
        r.expect(0);
        value = r.varintBig() != 0n;
        break;

      case 3:
        r.expect(0);
        value = int64ToValue(r.varintBig());
        break;

      case 4:
        r.expect(1);
        value = r.double();
        break;

      case 5: {
        r.expect(2);

        let array: OtlpValue[] = [];
        let inner = r.message();

        while (inner.next()) {
          if (inner.field == 1 && inner.wire == 2) {
            let item = decodeAnyValue(inner.message(), depth + 1);
            if (array.length < otlpLimits.maxArrayLength) array.push(item);
          } else {
            inner.skip();
          }
        }

        value = array;
        break;
      }

      case 6: {
        r.expect(2);

        let object = emptyObject();
        let count = 0;
        let inner = r.message();

        while (inner.next()) {
          if (inner.field == 1 && inner.wire == 2) {
            let [key, item] = decodeKeyValue(inner.message(), depth + 1);

            if (count < otlpLimits.maxArrayLength) {
              object[key] = item;
              count++;
            }
          } else {
            inner.skip();
          }
        }

        value = object;
        break;
      }

      case 7:
        r.expect(2);
        value = Buffer.from(r.bytes()).toString('base64');
        break;

      default:
        r.skip();
    }
  }

  return value;
};

let decodeKeyValue = (r: Reader, depth: number): [string, OtlpValue] => {
  let key = '';
  let value: OtlpValue = null;

  while (r.next()) {
    if (r.field == 1 && r.wire == 2) key = r.string();
    else if (r.field == 2 && r.wire == 2) value = decodeAnyValue(r.message(), depth);
    else r.skip();
  }

  return [key, value];
};

let readAttribute = (r: Reader, attributes: OtlpAttributes) => {
  let [key, value] = decodeKeyValue(r.message(), 0);

  if (!key) return;
  if (Object.keys(attributes).length >= otlpLimits.maxAttributesPerItem) return;

  attributes[key] = value;
};

let decodeResource = (r: Reader): OtlpResource => {
  let attributes = emptyAttributes();

  while (r.next()) {
    if (r.field == 1 && r.wire == 2) readAttribute(r, attributes);
    else r.skip();
  }

  return { attributes };
};

let decodeScope = (r: Reader): OtlpScope => {
  let scope: OtlpScope = { name: '', version: '', attributes: emptyAttributes() };

  while (r.next()) {
    if (r.field == 1 && r.wire == 2) scope.name = r.string();
    else if (r.field == 2 && r.wire == 2) scope.version = r.string();
    else if (r.field == 3 && r.wire == 2) readAttribute(r, scope.attributes);
    else r.skip();
  }

  return scope;
};

type ItemDecoder<T> = (r: Reader, items: T[], state: DecodeState) => void;

let guardedItem = <T>(decode: (r: Reader) => T[] | T | null): ItemDecoder<T> => {
  return (r, items, state) => {
    let reader = r.message();
    let decoded: T[] | T | null;

    try {
      decoded = decode(reader);
    } catch (error) {
      if (isServiceError(error)) throw error;
      if (!(error instanceof OtlpDecodeError)) throw error;

      state.malformed++;
      return;
    }

    if (decoded === null) return;

    for (let item of Array.isArray(decoded) ? decoded : [decoded]) {
      countItem(state);
      items.push(item);
    }
  };
};

let decodeResourceMessage = <T>(
  r: Reader,
  state: DecodeState,
  itemDecoder: ItemDecoder<T>
): OtlpGroup<T>[] => {
  let resource: OtlpResource = { attributes: emptyAttributes() };
  let scopes: { scope: OtlpScope; items: T[] }[] = [];

  while (r.next()) {
    if (r.field == 1 && r.wire == 2) {
      resource = decodeResource(r.message());
    } else if (r.field == 2 && r.wire == 2) {
      let inner = r.message();
      let scope: OtlpScope = { name: '', version: '', attributes: emptyAttributes() };
      let items: T[] = [];

      while (inner.next()) {
        if (inner.field == 1 && inner.wire == 2) scope = decodeScope(inner.message());
        else if (inner.field == 2 && inner.wire == 2) itemDecoder(inner, items, state);
        else inner.skip();
      }

      scopes.push({ scope, items });
    } else {
      r.skip();
    }
  }

  return scopes.map(entry => ({ resource, scope: entry.scope, items: entry.items }));
};

let decodeExport = <T>(bytes: Uint8Array, itemDecoder: ItemDecoder<T>): OtlpDecoded<T> => {
  let state = newState();
  let groups: OtlpGroup<T>[] = [];

  try {
    let root = new Reader(bytes);

    while (root.next()) {
      if (root.field == 1 && root.wire == 2) {
        groups.push(...decodeResourceMessage(root.message(), state, itemDecoder));
      } else {
        root.skip();
      }
    }
  } catch (error) {
    if (error instanceof ServiceError || isServiceError(error)) throw error;
    if (error instanceof OtlpDecodeError) throw error;

    throw new OtlpDecodeError('malformed protobuf');
  }

  return { groups, itemCount: state.itemCount, malformed: state.malformed };
};

let decodeLogRecord = (r: Reader): OtlpLogRecord => {
  let log: OtlpLogRecord = {
    timeNs: 0n,
    observedTimeNs: 0n,
    severityNumber: 0,
    severityText: '',
    eventName: '',
    body: null,
    attributes: emptyAttributes(),
    traceId: '',
    spanId: ''
  };

  while (r.next()) {
    switch (r.field) {
      case 1:
        r.expect(1);
        log.timeNs = r.fixed64();
        break;

      case 11:
        r.expect(1);
        log.observedTimeNs = r.fixed64();
        break;

      case 2:
        r.expect(0);
        log.severityNumber = r.varintNumber();
        break;

      case 3:
        r.expect(2);
        log.severityText = r.string();
        break;

      case 5:
        r.expect(2);
        log.body = decodeAnyValue(r.message(), 0);
        break;

      case 6:
        r.expect(2);
        readAttribute(r, log.attributes);
        break;

      case 9:
        r.expect(2);
        log.traceId = toHex(r.bytes());
        break;

      case 10:
        r.expect(2);
        log.spanId = toHex(r.bytes());
        break;

      case 12:
        r.expect(2);
        log.eventName = r.string();
        break;

      default:
        r.skip();
    }
  }

  return log;
};

let decodeSpan = (r: Reader): OtlpSpan => {
  let span: OtlpSpan = {
    traceId: '',
    spanId: '',
    parentSpanId: '',
    name: '',
    kind: 0,
    startNs: 0n,
    endNs: 0n,
    attributes: emptyAttributes(),
    events: [],
    statusCode: 0,
    statusMessage: ''
  };

  while (r.next()) {
    switch (r.field) {
      case 1:
        r.expect(2);
        span.traceId = toHex(r.bytes());
        break;

      case 2:
        r.expect(2);
        span.spanId = toHex(r.bytes());
        break;

      case 4:
        r.expect(2);
        span.parentSpanId = toHex(r.bytes());
        break;

      case 5:
        r.expect(2);
        span.name = r.string();
        break;

      case 6:
        r.expect(0);
        span.kind = r.varintNumber();
        break;

      case 7:
        r.expect(1);
        span.startNs = r.fixed64();
        break;

      case 8:
        r.expect(1);
        span.endNs = r.fixed64();
        break;

      case 9:
        r.expect(2);
        readAttribute(r, span.attributes);
        break;

      case 11: {
        r.expect(2);

        let inner = r.message();
        let event = { timeNs: 0n, name: '', attributes: emptyAttributes() };

        while (inner.next()) {
          if (inner.field == 1 && inner.wire == 1) event.timeNs = inner.fixed64();
          else if (inner.field == 2 && inner.wire == 2) event.name = inner.string();
          else if (inner.field == 3 && inner.wire == 2) readAttribute(inner, event.attributes);
          else inner.skip();
        }

        if (span.events.length < otlpLimits.maxArrayLength) span.events.push(event);
        break;
      }

      case 15: {
        r.expect(2);

        let inner = r.message();

        while (inner.next()) {
          if (inner.field == 2 && inner.wire == 2) span.statusMessage = inner.string();
          else if (inner.field == 3 && inner.wire == 0) span.statusCode = inner.varintNumber();
          else inner.skip();
        }

        break;
      }

      default:
        r.skip();
    }
  }

  return span;
};

type MetricShape = OtlpMetricPoint['shape'];

let temporalityOf = (value: number): OtlpTemporality =>
  value == 1 ? 'delta' : value == 2 ? 'cumulative' : 'unspecified';

let metricDataFields: Record<number, MetricShape> = {
  5: 'gauge',
  7: 'sum',
  9: 'histogram',
  10: 'exponential_histogram',
  11: 'summary'
};

let pointFields: Record<
  MetricShape,
  {
    attributes: number;
    start: number;
    time: number;
    count: number;
    sum: number;
    min?: number;
    max?: number;
  }
> = {
  gauge: { attributes: 7, start: 2, time: 3, count: 0, sum: 0 },
  sum: { attributes: 7, start: 2, time: 3, count: 0, sum: 0 },
  histogram: { attributes: 9, start: 2, time: 3, count: 4, sum: 5, min: 11, max: 12 },
  exponential_histogram: {
    attributes: 1,
    start: 2,
    time: 3,
    count: 4,
    sum: 5,
    min: 12,
    max: 13
  },
  summary: { attributes: 7, start: 2, time: 3, count: 4, sum: 5 }
};

let decodePoint = (
  r: Reader,
  shape: MetricShape,
  base: Pick<OtlpMetricPoint, 'name' | 'unit' | 'temporality' | 'monotonic'>
): OtlpMetricPoint => {
  let fields = pointFields[shape];

  let point: OtlpMetricPoint = {
    ...base,
    shape,
    startNs: 0n,
    timeNs: 0n,
    attributes: emptyAttributes(),
    value: null
  };

  let histogram: { count: number; sum?: number; min?: number; max?: number } | undefined;

  if (shape != 'gauge' && shape != 'sum') histogram = { count: 0 };

  while (r.next()) {
    if (r.field == fields.attributes && r.wire == 2) {
      readAttribute(r, point.attributes);
    } else if (r.field == fields.start && r.wire == 1) {
      point.startNs = r.fixed64();
    } else if (r.field == fields.time && r.wire == 1) {
      point.timeNs = r.fixed64();
    } else if ((shape == 'gauge' || shape == 'sum') && r.field == 4 && r.wire == 1) {
      point.value = r.double();
    } else if ((shape == 'gauge' || shape == 'sum') && r.field == 6 && r.wire == 1) {
      point.value = Number(BigInt.asIntN(64, r.fixed64()));
    } else if (histogram && r.field == fields.count && r.wire == 1) {
      histogram.count = Number(r.fixed64());
    } else if (histogram && r.field == fields.sum && r.wire == 1) {
      histogram.sum = r.double();
    } else if (histogram && r.field == fields.min && r.wire == 1) {
      histogram.min = r.double();
    } else if (histogram && r.field == fields.max && r.wire == 1) {
      histogram.max = r.double();
    } else {
      r.skip();
    }
  }

  if (histogram) {
    point.histogram = histogram;
    point.value = histogram.sum ?? null;
  }

  return point;
};

let decodeMetric = (r: Reader): OtlpMetricPoint[] => {
  let name = '';
  let unit = '';
  let data: { shape: MetricShape; reader: Reader } | undefined;

  while (r.next()) {
    if (r.field == 1 && r.wire == 2) {
      name = r.string();
    } else if (r.field == 3 && r.wire == 2) {
      unit = r.string();
    } else if (metricDataFields[r.field] && r.wire == 2) {
      data = { shape: metricDataFields[r.field]!, reader: r.message() };
    } else {
      r.skip();
    }
  }

  if (!data) return [];

  let temporality: OtlpTemporality = 'unspecified';
  let monotonic = false;
  let pointReaders: Reader[] = [];

  while (data.reader.next()) {
    if (data.reader.field == 1 && data.reader.wire == 2) {
      pointReaders.push(data.reader.message());
    } else if (data.reader.field == 2 && data.reader.wire == 0 && data.shape != 'gauge') {
      temporality = temporalityOf(data.reader.varintNumber());
    } else if (data.reader.field == 3 && data.reader.wire == 0 && data.shape == 'sum') {
      monotonic = data.reader.varintBig() != 0n;
    } else {
      data.reader.skip();
    }
  }

  return pointReaders.map(reader =>
    decodePoint(reader, data!.shape, {
      name,
      unit,
      temporality: data!.shape == 'gauge' ? 'unspecified' : temporality,
      monotonic
    })
  );
};

let logItem = guardedItem<OtlpLogRecord>(decodeLogRecord);
let spanItem = guardedItem<OtlpSpan>(decodeSpan);
let metricItem = guardedItem<OtlpMetricPoint>(decodeMetric);

export let decodeLogsProtobuf = (bytes: Uint8Array) => decodeExport(bytes, logItem);

export let decodeTracesProtobuf = (bytes: Uint8Array) => decodeExport(bytes, spanItem);

export let decodeMetricsProtobuf = (bytes: Uint8Array) => decodeExport(bytes, metricItem);
