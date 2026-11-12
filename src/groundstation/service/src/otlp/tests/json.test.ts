import { isServiceError } from '@lowerdeck/error';
import { describe, expect, it } from 'vitest';
import { decodeLogsJson, decodeMetricsJson, decodeTracesJson } from '../json';
import { OtlpDecodeError, otlpLimits } from '../model';
import { jsonBytes, logsJson, metricsJson, tracesJson } from '../../test/protobuf';
import {
  logGroups,
  metricGroups,
  parentHex,
  spanHex,
  traceGroups,
  traceHex
} from './fixtures';

let encode = (value: unknown) => jsonBytes(value);

let logRequest = (records: unknown[], resource: unknown = {}, scope: unknown = {}) =>
  encode({
    resourceLogs: [{ resource, scopeLogs: [{ scope, logRecords: records }] }]
  });

describe('decodeLogsJson', () => {
  it('decodes a realistic export', () => {
    let decoded = decodeLogsJson(jsonBytes(logsJson(logGroups)));

    expect(decoded.itemCount).toBe(3);
    expect(decoded.malformed).toBe(0);
    expect(decoded.groups).toHaveLength(2);

    let [first, second] = decoded.groups;

    expect(first?.resource.attributes['service.name']).toBe('claude-code');
    expect(first?.resource.attributes['process.pid']).toBe(4242);
    expect(first?.scope).toMatchObject({
      name: 'com.anthropic.claude_code.events',
      version: '2.1.0'
    });
    expect(first?.scope.attributes['scope.flag']).toBe(true);
    expect(second?.resource.attributes['service.name']).toBe('codex_cli_rs');

    let log = first!.items[0]!;

    expect(log).toMatchObject({
      timeNs: 1_781_524_800_123_456_789n,
      observedTimeNs: 1_781_524_800_200_000_000n,
      severityNumber: 9,
      severityText: 'INFO',
      eventName: 'claude_code.user_prompt',
      body: 'claude_code.user_prompt',
      traceId: traceHex,
      spanId: spanHex
    });

    expect({ ...log.attributes }).toEqual({
      'event.name': 'user_prompt',
      'session.id': 'sess-1',
      'prompt.id': 'p-1',
      prompt_length: 42,
      'is.test': false,
      ratio: 0.25,
      big: '9007199254740993',
      negative: -7,
      tags: ['a', 'b', 3],
      nested: { inner: 'x', deep: { n: 1 } },
      raw: Buffer.from([1, 2, 3, 255]).toString('base64'),
      unicode: 'héllo 😀 世界'
    });

    expect(first!.items[1]!.body).toEqual({ structured: 'body', n: 2 });
  });

  it('accepts int64 as string or number', () => {
    let decoded = decodeLogsJson(
      logRequest([
        {
          body: { intValue: '5' },
          timeUnixNano: '1781524800000000000',
          attributes: [
            { key: 'a', value: { intValue: '-9223372036854775808' } },
            { key: 'b', value: { intValue: 12 } },
            { key: 'c', value: { intValue: '9007199254740993' } }
          ]
        },
        { timeUnixNano: 1781524800000, body: 'x' }
      ])
    );

    let [first, second] = decoded.groups[0]!.items;

    expect(first?.body).toBe(5);
    expect(first?.timeNs).toBe(1781524800000000000n);
    expect({ ...first?.attributes }).toEqual({
      a: '-9223372036854775808',
      b: 12,
      c: '9007199254740993'
    });
    expect(second?.timeNs).toBe(1781524800000n);
  });

  it('accepts snake_case field names', () => {
    let decoded = decodeLogsJson(
      encode({
        resource_logs: [
          {
            scope_logs: [
              {
                log_records: [
                  {
                    time_unix_nano: '1781524800000000000',
                    severity_text: 'WARN',
                    trace_id: traceHex,
                    body: { string_value: 'ignored-shape' }
                  }
                ]
              }
            ]
          }
        ]
      })
    );

    expect(decoded.groups[0]?.items[0]).toMatchObject({
      timeNs: 1781524800000000000n,
      severityText: 'WARN',
      traceId: traceHex
    });
  });

  it('accepts hex and base64 ids and rejects others', () => {
    let base64Trace = Buffer.from(traceHex, 'hex').toString('base64');
    let base64Span = Buffer.from(spanHex, 'hex').toString('base64');

    let decoded = decodeLogsJson(
      logRequest([
        { traceId: traceHex.toUpperCase(), spanId: spanHex },
        { traceId: base64Trace, spanId: base64Span },
        { traceId: 'xyz', spanId: 'not-hex-or-b64!' },
        { traceId: 5, spanId: null },
        { traceId: 'QUJDRA==', spanId: '' }
      ])
    );

    let items = decoded.groups[0]!.items;

    expect(items[0]).toMatchObject({ traceId: traceHex, spanId: spanHex });
    expect(items[1]).toMatchObject({ traceId: traceHex, spanId: spanHex });
    expect(items[2]).toMatchObject({ traceId: '', spanId: '' });
    expect(items[3]).toMatchObject({ traceId: '', spanId: '' });
    expect(items[4]).toMatchObject({ traceId: '', spanId: '' });
  });

  it('parses severity names and numbers', () => {
    let decoded = decodeLogsJson(
      logRequest([
        { severityNumber: 'SEVERITY_NUMBER_ERROR' },
        { severityNumber: 13 },
        { severityNumber: '5' },
        { severityNumber: 'bogus' },
        {}
      ])
    );

    expect(decoded.groups[0]!.items.map(item => item.severityNumber)).toEqual([
      17, 13, 5, 0, 0
    ]);
  });

  it('coerces missing and wrongly typed fields to defaults', () => {
    let decoded = decodeLogsJson(
      logRequest([
        {
          timeUnixNano: 'abc',
          observedTimeUnixNano: -5,
          severityText: 5,
          eventName: {},
          body: undefined,
          attributes: 'nope'
        },
        { timeUnixNano: '123456789012345678901234' }
      ])
    );

    let [first, second] = decoded.groups[0]!.items;

    expect(first).toMatchObject({
      timeNs: 0n,
      observedTimeNs: 0n,
      severityText: '',
      eventName: '',
      body: null
    });
    expect({ ...first?.attributes }).toEqual({});
    expect(second?.timeNs).toBe(0n);
  });

  it('accepts attributes as a plain object', () => {
    let decoded = decodeLogsJson(logRequest([{ attributes: { a: 'x', b: 2 } }]));

    expect({ ...decoded.groups[0]!.items[0]!.attributes }).toEqual({ a: 'x', b: 2 });
  });

  it('skips attribute entries without a usable key', () => {
    let decoded = decodeLogsJson(
      logRequest([
        {
          attributes: [
            { key: '', value: { stringValue: 'x' } },
            { value: { stringValue: 'y' } },
            { key: 5, value: { stringValue: 'z' } },
            'junk',
            null,
            { key: 'ok', value: { stringValue: 'fine' } }
          ]
        }
      ])
    );

    expect({ ...decoded.groups[0]!.items[0]!.attributes }).toEqual({ ok: 'fine' });
  });

  it('decodes every AnyValue shape', () => {
    let decoded = decodeLogsJson(
      logRequest([
        {
          attributes: [
            { key: 'nan', value: { doubleValue: 'NaN' } },
            { key: 'inf', value: { doubleValue: 'Infinity' } },
            { key: 'dstr', value: { doubleValue: '1.5' } },
            { key: 'dbad', value: { doubleValue: 'x' } },
            { key: 'ibad', value: { intValue: 'x' } },
            { key: 'ifloat', value: { intValue: 3.9 } },
            {
              key: 'arr',
              value: { arrayValue: { values: [{ stringValue: 'a' }, { intValue: '1' }] } }
            },
            { key: 'emptyarr', value: { arrayValue: {} } },
            {
              key: 'kv',
              value: {
                kvlistValue: {
                  values: [
                    { key: 'k', value: { boolValue: true } },
                    { key: '', value: {} }
                  ]
                }
              }
            },
            { key: 'bytes', value: { bytesValue: 'AQID' } },
            { key: 'empty', value: {} },
            { key: 'rawprimitive', value: 5 },
            { key: 'rawnull', value: null }
          ]
        }
      ])
    );

    expect({ ...decoded.groups[0]!.items[0]!.attributes }).toEqual({
      nan: null,
      inf: null,
      dstr: 1.5,
      dbad: null,
      ibad: null,
      ifloat: 3,
      arr: ['a', 1],
      emptyarr: [],
      kv: { k: true },
      bytes: 'AQID',
      empty: {},
      rawprimitive: 5,
      rawnull: null
    });
  });

  it('keeps hostile keys as plain data without touching prototypes', () => {
    let body = `{"resourceLogs":[{"scopeLogs":[{"logRecords":[{"attributes":[{"key":"__proto__","value":{"stringValue":"polluted"}},{"key":"constructor","value":{"stringValue":"c"}}],"body":{"__proto__":{"x":1},"y":2}}]}]}]}`;

    let decoded = decodeLogsJson(new TextEncoder().encode(body));
    let log = decoded.groups[0]!.items[0]!;

    expect(Object.keys(log.attributes)).toEqual(['__proto__', 'constructor']);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(Object.getPrototypeOf(log.attributes)).toBeNull();
    expect(Object.keys(log.body as object)).toContain('y');
    expect(Object.getPrototypeOf(log.body)).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'x')).toBe(false);
  });

  it('caps attributes per item', () => {
    let attributes = Array.from({ length: 1000 }, (_, i) => ({
      key: `k${i}`,
      value: { intValue: String(i) }
    }));

    let decoded = decodeLogsJson(logRequest([{ attributes }]));

    expect(Object.keys(decoded.groups[0]!.items[0]!.attributes)).toHaveLength(
      otlpLimits.maxAttributesPerItem
    );
  });

  it('caps array length and kvlist size', () => {
    let values = Array.from({ length: 1000 }, (_, i) => ({ intValue: String(i) }));
    let kv = Array.from({ length: 1000 }, (_, i) => ({
      key: `k${i}`,
      value: { intValue: '1' }
    }));

    let decoded = decodeLogsJson(
      logRequest([
        {
          attributes: [
            { key: 'arr', value: { arrayValue: { values } } },
            { key: 'kv', value: { kvlistValue: { values: kv } } }
          ]
        }
      ])
    );

    let attributes = decoded.groups[0]!.items[0]!.attributes;

    expect((attributes['arr'] as unknown[]).length).toBe(otlpLimits.maxArrayLength);
    expect(Object.keys(attributes['kv'] as object)).toHaveLength(otlpLimits.maxArrayLength);
  });

  it('marks an item with excessive nesting as malformed', () => {
    let value: unknown = { stringValue: 'leaf' };
    for (let i = 0; i < otlpLimits.maxDepth + 4; i++) {
      value = { arrayValue: { values: [value] } };
    }

    let decoded = decodeLogsJson(
      logRequest([
        { attributes: [{ key: 'deep', value }] },
        { attributes: [{ key: 'fine', value: { stringValue: 'x' } }] }
      ])
    );

    expect(decoded.malformed).toBe(1);
    expect(decoded.itemCount).toBe(1);
    expect(decoded.groups[0]!.items).toHaveLength(1);
  });

  it('accepts nesting right at the limit', () => {
    let value: unknown = { stringValue: 'leaf' };
    for (let i = 0; i < otlpLimits.maxDepth; i++) {
      value = { arrayValue: { values: [value] } };
    }

    let decoded = decodeLogsJson(logRequest([{ attributes: [{ key: 'deep', value }] }]));

    expect(decoded.malformed).toBe(0);
  });

  it('survives a very deeply nested body without a stack overflow', () => {
    let depth = 50_000;
    let text =
      `{"resourceLogs":[{"scopeLogs":[{"logRecords":[{"body":` +
      '['.repeat(depth) +
      ']'.repeat(depth) +
      '}]}]}]}';

    let outcome = (() => {
      try {
        return decodeLogsJson(new TextEncoder().encode(text));
      } catch (error) {
        return error;
      }
    })();

    if (outcome instanceof Error) expect(outcome).toBeInstanceOf(OtlpDecodeError);
    else {
      let decoded = outcome as ReturnType<typeof decodeLogsJson>;
      expect(decoded.malformed + decoded.itemCount).toBe(1);
    }
  });

  it('counts non-object entries as malformed and keeps going', () => {
    let decoded = decodeLogsJson(
      encode({
        resourceLogs: [
          'bad-resource',
          {
            scopeLogs: ['bad-scope', { logRecords: ['bad-log', 5, null, [], { body: 'ok' }] }]
          }
        ]
      })
    );

    expect(decoded.malformed).toBe(6);
    expect(decoded.itemCount).toBe(1);
  });

  it('treats absent roots as empty', () => {
    expect(decodeLogsJson(encode({}))).toEqual({ groups: [], itemCount: 0, malformed: 0 });
    expect(decodeLogsJson(encode({ resourceLogs: [] })).groups).toEqual([]);
    expect(decodeLogsJson(encode({ resourceLogs: [{}] })).groups).toEqual([]);
  });

  it('keeps a scope with no records as an empty group', () => {
    let decoded = decodeLogsJson(
      encode({ resourceLogs: [{ scopeLogs: [{ logRecords: [] }] }] })
    );

    expect(decoded.groups).toHaveLength(1);
    expect(decoded.groups[0]?.items).toEqual([]);
  });

  it('enforces the item limit with a service error', () => {
    let records = Array.from({ length: otlpLimits.maxItems + 1 }, () => ({ body: 'x' }));

    let error = (() => {
      try {
        decodeLogsJson(logRequest(records));
      } catch (e) {
        return e;
      }
    })();

    expect(isServiceError(error)).toBe(true);
    expect((error as { data: { code: string } }).data.code).toBe('too_many_items');
  });

  it('accepts exactly the item limit', () => {
    let records = Array.from({ length: otlpLimits.maxItems }, () => ({}));

    expect(decodeLogsJson(logRequest(records)).itemCount).toBe(otlpLimits.maxItems);
  });
});

describe('JSON structural errors', () => {
  let message = (fn: () => unknown) => {
    try {
      fn();
    } catch (error) {
      expect(error).toBeInstanceOf(OtlpDecodeError);
      return (error as Error).message;
    }

    return undefined;
  };

  it('rejects invalid json', () => {
    expect(message(() => decodeLogsJson(new TextEncoder().encode('{nope')))).toBe(
      'invalid json'
    );
    expect(message(() => decodeLogsJson(new Uint8Array()))).toBe('invalid json');
  });

  it('rejects invalid utf-8', () => {
    expect(message(() => decodeLogsJson(Uint8Array.from([0x7b, 0xff, 0xfe, 0x7d])))).toBe(
      'invalid json'
    );
  });

  it.each(['[]', '"text"', '5', 'null', 'true'])('rejects the non-object root %s', text => {
    expect(message(() => decodeLogsJson(new TextEncoder().encode(text)))).toBe(
      'the body must be a JSON object'
    );
  });

  it('rejects a non-array resource list', () => {
    expect(message(() => decodeLogsJson(encode({ resourceLogs: {} })))).toBe(
      'resourceLogs must be an array'
    );
    expect(message(() => decodeMetricsJson(encode({ resourceMetrics: 'x' })))).toBe(
      'resourceMetrics must be an array'
    );
    expect(message(() => decodeTracesJson(encode({ resourceSpans: 1 })))).toBe(
      'resourceSpans must be an array'
    );
  });

  it('never leaks payload content in errors', () => {
    let text = '{"secret-sentinel": ';

    expect(message(() => decodeLogsJson(new TextEncoder().encode(text)))).not.toContain(
      'sentinel'
    );
  });
});

describe('decodeMetricsJson', () => {
  it('decodes every metric shape', () => {
    let decoded = decodeMetricsJson(jsonBytes(metricsJson(metricGroups)));

    expect(decoded.malformed).toBe(0);
    expect(decoded.itemCount).toBe(6);

    let points = decoded.groups[0]!.items;

    expect(points[0]).toMatchObject({
      name: 'claude_code.token.usage',
      unit: 'tokens',
      shape: 'sum',
      temporality: 'delta',
      monotonic: true,
      startNs: 1_781_524_740_000_000_000n,
      timeNs: 1_781_524_800_000_000_000n,
      value: 1200
    });
    expect({ ...points[0]!.attributes }).toEqual({
      type: 'input',
      model: 'claude-sonnet-4-5'
    });
    expect(points[1]!.value).toBe(340.5);

    expect(points[2]).toMatchObject({
      shape: 'gauge',
      temporality: 'unspecified',
      value: 12.5
    });

    expect(points[3]).toMatchObject({
      shape: 'histogram',
      temporality: 'cumulative',
      value: 6.5,
      histogram: { count: 4, sum: 6.5, min: 0.5, max: 3 }
    });

    expect(points[4]).toMatchObject({ shape: 'exponential_histogram', temporality: 'delta' });
    expect(points[5]).toMatchObject({ shape: 'summary', histogram: { count: 3, sum: 12 } });
  });

  it('accepts asInt as number or string and named temporality', () => {
    let decoded = decodeMetricsJson(
      encode({
        resourceMetrics: [
          {
            scopeMetrics: [
              {
                metrics: [
                  {
                    name: 'm',
                    sum: {
                      aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
                      isMonotonic: true,
                      dataPoints: [{ asInt: '7' }, { asInt: 8 }, { asDouble: '2.5' }, {}]
                    }
                  }
                ]
              }
            ]
          }
        ]
      })
    );

    let points = decoded.groups[0]!.items;

    expect(points.map(point => point.value)).toEqual([7, 8, 2.5, null]);
    expect(points[0]).toMatchObject({ temporality: 'cumulative', monotonic: true });
  });

  it('prefers asDouble over asInt when both are present', () => {
    let decoded = decodeMetricsJson(
      encode({
        resourceMetrics: [
          {
            scopeMetrics: [
              {
                metrics: [
                  { name: 'm', gauge: { dataPoints: [{ asDouble: 1.5, asInt: '9' }] } }
                ]
              }
            ]
          }
        ]
      })
    );

    expect(decoded.groups[0]!.items[0]!.value).toBe(1.5);
  });

  it('drops metrics with no recognised data and non-object points', () => {
    let decoded = decodeMetricsJson(
      encode({
        resourceMetrics: [
          {
            scopeMetrics: [
              {
                metrics: [
                  { name: 'nodata' },
                  { name: 'bad', gauge: { dataPoints: ['x', 1, null] } },
                  { name: 'ok', gauge: { dataPoints: [{ asInt: '1' }] } }
                ]
              }
            ]
          }
        ]
      })
    );

    expect(decoded.groups[0]!.items.map(point => point.name)).toEqual(['ok']);
  });

  it('turns non-finite histogram numbers into defaults', () => {
    let decoded = decodeMetricsJson(
      encode({
        resourceMetrics: [
          {
            scopeMetrics: [
              {
                metrics: [
                  {
                    name: 'h',
                    histogram: { dataPoints: [{ count: 'x', sum: 'nope', min: 1e999 }] }
                  }
                ]
              }
            ]
          }
        ]
      })
    );

    let point = decoded.groups[0]!.items[0]!;

    expect(point.histogram?.count).toBe(0);
    expect(point.histogram?.sum).toBeUndefined();
    expect(point.value).toBeNull();
  });

  it('counts each point towards the item limit', () => {
    let dataPoints = Array.from({ length: otlpLimits.maxItems + 1 }, () => ({ asInt: '1' }));

    expect(() =>
      decodeMetricsJson(
        encode({
          resourceMetrics: [
            { scopeMetrics: [{ metrics: [{ name: 'm', gauge: { dataPoints } }] }] }
          ]
        })
      )
    ).toThrow();
  });
});

describe('decodeTracesJson', () => {
  it('decodes spans with events and status', () => {
    let decoded = decodeTracesJson(jsonBytes(tracesJson(traceGroups)));

    expect(decoded.itemCount).toBe(2);

    let [span, bare] = decoded.groups[0]!.items;

    expect(span).toMatchObject({
      traceId: traceHex,
      spanId: spanHex,
      parentSpanId: parentHex,
      name: 'chat claude-sonnet-4-5',
      kind: 3,
      startNs: 1_781_524_800_000_000_000n,
      endNs: 1_781_524_802_500_000_000n,
      statusCode: 2,
      statusMessage: 'boom'
    });
    expect(span?.events).toHaveLength(1);
    expect(span?.events[0]).toMatchObject({
      timeNs: 1_781_524_801_000_000_000n,
      name: 'gen_ai.content.prompt'
    });
    expect({ ...span?.events[0]?.attributes }).toEqual({ 'gen_ai.prompt': 'hi' });

    expect(bare).toMatchObject({
      name: 'bare',
      kind: 0,
      statusCode: 0,
      statusMessage: '',
      events: []
    });
  });

  it('parses named kinds and status codes and ignores bad events', () => {
    let decoded = decodeTracesJson(
      encode({
        resourceSpans: [
          {
            scopeSpans: [
              {
                spans: [
                  {
                    kind: 'SPAN_KIND_CLIENT',
                    status: { code: 'STATUS_CODE_ERROR' },
                    events: ['bad', null, { name: 'ok' }]
                  },
                  { kind: 'nope', status: 'weird' }
                ]
              }
            ]
          }
        ]
      })
    );

    let [first, second] = decoded.groups[0]!.items;

    expect(first).toMatchObject({ kind: 3, statusCode: 2 });
    expect(first?.events.map(event => event.name)).toEqual(['ok']);
    expect(second).toMatchObject({ kind: 0, statusCode: 0 });
  });

  it('caps events per span', () => {
    let events = Array.from({ length: 1000 }, (_, i) => ({ name: `e${i}` }));

    let decoded = decodeTracesJson(
      encode({ resourceSpans: [{ scopeSpans: [{ spans: [{ events }] }] }] })
    );

    expect(decoded.groups[0]!.items[0]!.events).toHaveLength(otlpLimits.maxArrayLength);
  });
});
