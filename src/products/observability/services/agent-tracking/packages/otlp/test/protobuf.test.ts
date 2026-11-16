import { isServiceError } from '@lowerdeck/error';
import { describe, expect, it } from 'vitest';
import { decodeOtlp } from '../src';
import { OtlpDecodeError, otlpLimits } from '../src/model';
import {
  decodeLogsProtobuf,
  decodeMetricsProtobuf,
  decodeTracesProtobuf
} from '../src/protobuf';
import {
  concat,
  doubleField,
  encodeLogsRequest,
  encodeMetricsRequest,
  encodeTracesRequest,
  fixed64Field,
  lengthDelimited,
  stringField,
  tag,
  varint,
  varintField
} from '@mtsrc/agent-tracking-testing';
import {
  logGroups,
  metricGroups,
  parentHex,
  spanHex,
  traceGroups,
  traceHex
} from './fixtures';

let oneLog = (logBytes: Uint8Array, resourceBytes: Uint8Array[] = []) =>
  concat(
    lengthDelimited(
      1,
      concat(...resourceBytes, lengthDelimited(2, lengthDelimited(2, logBytes)))
    )
  );

let attribute = (field: number, key: string, anyValue: Uint8Array) =>
  lengthDelimited(field, concat(stringField(1, key), lengthDelimited(2, anyValue)));

let errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error;
  }

  return undefined;
};

describe('decodeLogsProtobuf', () => {
  it('decodes a realistic export', () => {
    let decoded = decodeLogsProtobuf(encodeLogsRequest(logGroups));

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
    expect(second?.scope.name).toBe('codex');

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

  it('returns an empty result for an empty body', () => {
    expect(decodeLogsProtobuf(new Uint8Array())).toEqual({
      groups: [],
      itemCount: 0,
      malformed: 0
    });
  });

  it('works on a subarray of a larger buffer', () => {
    let payload = encodeLogsRequest(logGroups);
    let padded = new Uint8Array(payload.length + 20);
    padded.set(payload, 10);

    let decoded = decodeLogsProtobuf(padded.subarray(10, 10 + payload.length));

    expect(decoded.itemCount).toBe(3);
  });

  it('skips unknown fields of every wire type at every level', () => {
    let unknown = [
      varintField(99, 7),
      fixed64Field(98, 5n),
      lengthDelimited(97, new Uint8Array([1, 2, 3])),
      concat(tag(96, 5), new Uint8Array(4))
    ];

    let log = concat(...unknown, stringField(3, 'WARN'), ...unknown);
    let decoded = decodeLogsProtobuf(
      concat(...unknown, oneLog(log, [lengthDelimited(1, concat(...unknown))]))
    );

    expect(decoded.malformed).toBe(0);
    expect(decoded.groups[0]?.items[0]?.severityText).toBe('WARN');
  });

  it('counts a wire-type mismatch as one malformed item and keeps the others', () => {
    let bad = concat(tag(1, 2), varint(0));
    let good = stringField(3, 'INFO');

    let decoded = decodeLogsProtobuf(
      lengthDelimited(
        1,
        lengthDelimited(2, concat(lengthDelimited(2, bad), lengthDelimited(2, good)))
      )
    );

    expect(decoded.malformed).toBe(1);
    expect(decoded.itemCount).toBe(1);
    expect(decoded.groups[0]?.items[0]?.severityText).toBe('INFO');
  });

  it('replaces invalid utf-8 instead of failing', () => {
    let log = concat(tag(3, 2), varint(3), Uint8Array.from([0x61, 0xff, 0x62]));

    let decoded = decodeLogsProtobuf(oneLog(log));

    expect(decoded.groups[0]?.items[0]?.severityText).toBe('a�b');
  });

  it('decodes negative and large integers', () => {
    let minusOne = concat(
      tag(3, 0),
      Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01])
    );
    let log = concat(
      attribute(6, 'neg', minusOne),
      attribute(6, 'max', varintField(3, 9_223_372_036_854_775_807n)),
      attribute(6, 'min', varintField(3, -9_223_372_036_854_775_808n)),
      attribute(6, 'safe', varintField(3, 9_007_199_254_740_991n)),
      attribute(6, 'unsafe', varintField(3, 9_007_199_254_740_992n))
    );

    let attributes = decodeLogsProtobuf(oneLog(log)).groups[0]!.items[0]!.attributes;

    expect({ ...attributes }).toEqual({
      neg: -1,
      max: '9223372036854775807',
      min: '-9223372036854775808',
      safe: 9_007_199_254_740_991,
      unsafe: '9007199254740992'
    });
  });

  it('treats any non-zero varint as true and clamps huge severity numbers', () => {
    let log = concat(
      attribute(6, 'b', varintField(2, 5)),
      attribute(6, 'f', varintField(2, 0)),
      varintField(2, 2n ** 63n)
    );

    let item = decodeLogsProtobuf(oneLog(log)).groups[0]!.items[0]!;

    expect(item.attributes['b']).toBe(true);
    expect(item.attributes['f']).toBe(false);
    expect(item.severityNumber).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('ignores attributes without a key', () => {
    let log = concat(
      attribute(6, '', stringField(1, 'x')),
      lengthDelimited(6, lengthDelimited(2, stringField(1, 'orphan'))),
      attribute(6, 'ok', stringField(1, 'y'))
    );

    let attributes = decodeLogsProtobuf(oneLog(log)).groups[0]!.items[0]!.attributes;

    expect({ ...attributes }).toEqual({ ok: 'y' });
  });

  it('keeps hostile keys as plain data', () => {
    let log = concat(
      attribute(6, '__proto__', stringField(1, 'polluted')),
      attribute(6, 'constructor', stringField(1, 'c')),
      lengthDelimited(
        5,
        lengthDelimited(
          6,
          lengthDelimited(
            1,
            concat(stringField(1, '__proto__'), lengthDelimited(2, stringField(1, 'x')))
          )
        )
      )
    );

    let item = decodeLogsProtobuf(oneLog(log)).groups[0]!.items[0]!;

    expect(Object.keys(item.attributes)).toEqual(['__proto__', 'constructor']);
    expect(Object.getPrototypeOf(item.attributes)).toBeNull();
    expect(Object.getPrototypeOf(item.body)).toBeNull();
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('caps attributes, array length and kvlist size', () => {
    let many = Array.from({ length: 600 }, (_, i) => attribute(6, `k${i}`, varintField(3, i)));

    let array = lengthDelimited(
      5,
      concat(...Array.from({ length: 600 }, (_, i) => lengthDelimited(1, varintField(3, i))))
    );

    let kvlist = lengthDelimited(
      6,
      concat(
        ...Array.from({ length: 600 }, (_, i) =>
          lengthDelimited(
            1,
            concat(stringField(1, `k${i}`), lengthDelimited(2, varintField(3, i)))
          )
        )
      )
    );

    let item = decodeLogsProtobuf(
      oneLog(concat(...many, attribute(6, 'arr', array), attribute(6, 'kv', kvlist)))
    ).groups[0]!.items[0]!;

    expect(Object.keys(item.attributes)).toHaveLength(otlpLimits.maxAttributesPerItem);
    expect(item.attributes['arr']).toBeUndefined();
  });

  it('caps array and kvlist sizes when they fit in the attribute budget', () => {
    let array = lengthDelimited(
      5,
      concat(...Array.from({ length: 600 }, (_, i) => lengthDelimited(1, varintField(3, i))))
    );

    let kvlist = lengthDelimited(
      6,
      concat(
        ...Array.from({ length: 600 }, (_, i) =>
          lengthDelimited(
            1,
            concat(stringField(1, `k${i}`), lengthDelimited(2, varintField(3, i)))
          )
        )
      )
    );

    let item = decodeLogsProtobuf(
      oneLog(concat(attribute(6, 'arr', array), attribute(6, 'kv', kvlist)))
    ).groups[0]!.items[0]!;

    expect((item.attributes['arr'] as unknown[]).length).toBe(otlpLimits.maxArrayLength);
    expect(Object.keys(item.attributes['kv'] as object)).toHaveLength(
      otlpLimits.maxArrayLength
    );
  });

  it('marks an item with excessive nesting as malformed', () => {
    let value: Uint8Array = stringField(1, 'leaf');
    for (let i = 0; i < otlpLimits.maxDepth + 4; i++) {
      value = lengthDelimited(5, lengthDelimited(1, value));
    }

    let decoded = decodeLogsProtobuf(
      oneLog(concat(attribute(6, 'deep', value), stringField(3, 'x')))
    );

    expect(decoded.malformed).toBe(1);
    expect(decoded.itemCount).toBe(0);
  });

  it('survives extreme nesting depth without overflowing the stack', () => {
    let value: Uint8Array = stringField(1, 'leaf');
    for (let i = 0; i < 5000; i++) value = lengthDelimited(5, lengthDelimited(1, value));

    let decoded = decodeLogsProtobuf(oneLog(attribute(6, 'deep', value)));

    expect(decoded.malformed).toBe(1);
  });

  it('enforces the item limit with a service error', () => {
    let records = concat(
      ...Array.from({ length: otlpLimits.maxItems + 1 }, () =>
        lengthDelimited(2, new Uint8Array())
      )
    );

    let error = errorOf(() =>
      decodeLogsProtobuf(lengthDelimited(1, lengthDelimited(2, records)))
    );

    expect(isServiceError(error)).toBe(true);
    expect((error as { data: { code: string } }).data.code).toBe('too_many_items');
  });

  it('accepts exactly the item limit', () => {
    let records = concat(
      ...Array.from({ length: otlpLimits.maxItems }, () =>
        lengthDelimited(2, new Uint8Array())
      )
    );

    let decoded = decodeLogsProtobuf(lengthDelimited(1, lengthDelimited(2, records)));

    expect(decoded.itemCount).toBe(otlpLimits.maxItems);
  });
});

describe('protobuf structural errors', () => {
  let cases: [string, Uint8Array, string][] = [
    ['field number zero', Uint8Array.from([0x00]), 'invalid field number'],
    ['truncated varint', Uint8Array.from([0x80]), 'truncated varint'],
    [
      'overlong varint tag',
      Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
      'varint too long'
    ],
    [
      'length beyond the message',
      Uint8Array.from([0x0a, 0x05, 0x01]),
      'length exceeds message'
    ],
    ['deprecated group wire type', Uint8Array.from([0x0b]), 'unsupported wire type'],
    ['truncated fixed64', Uint8Array.from([0x09, 0x01, 0x02]), 'truncated field'],
    ['truncated skipped fixed32', Uint8Array.from([0x1d, 0x01]), 'truncated field']
  ];

  it.each(cases)('rejects %s', (_name, bytes, message) => {
    let error = errorOf(() => decodeLogsProtobuf(bytes));

    expect(error).toBeInstanceOf(OtlpDecodeError);
    expect((error as Error).message).toBe(message);
  });

  it('rejects a nested length that overruns its parent', () => {
    let inner = lengthDelimited(2, new Uint8Array([1, 2, 3, 4]));
    let truncated = inner.subarray(0, inner.length - 2);

    expect(errorOf(() => decodeLogsProtobuf(lengthDelimited(1, truncated)))).toBeInstanceOf(
      OtlpDecodeError
    );
  });

  it('rejects every proper prefix of a valid export or decodes it cleanly', () => {
    let payload = encodeLogsRequest(logGroups);

    for (let cut = 0; cut < payload.length; cut++) {
      let error = errorOf(() => decodeLogsProtobuf(payload.subarray(0, cut)));

      if (error !== undefined) expect(error).toBeInstanceOf(OtlpDecodeError);
    }
  });

  it('never leaks payload content in errors', () => {
    let payload = concat(
      lengthDelimited(1, stringField(1, 'secret-sentinel')),
      Uint8Array.from([0x80])
    );
    let error = errorOf(() => decodeLogsProtobuf(payload)) as Error;

    expect(error.message).not.toContain('sentinel');
  });
});

describe('decodeMetricsProtobuf', () => {
  it('decodes every metric shape', () => {
    let decoded = decodeMetricsProtobuf(encodeMetricsRequest(metricGroups));

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
    expect(points[4]).toMatchObject({
      shape: 'exponential_histogram',
      temporality: 'delta',
      histogram: { count: 2, sum: 9, min: 4, max: 5 }
    });
    expect(points[5]).toMatchObject({ shape: 'summary', histogram: { count: 3, sum: 12 } });
  });

  it('decodes negative integer data points', () => {
    let decoded = decodeMetricsProtobuf(
      encodeMetricsRequest([
        {
          items: [
            {
              name: 'm',
              shape: 'gauge',
              points: [{ asInt: -5 }, { asInt: 0 }, { asInt: 2n ** 40n }]
            }
          ]
        }
      ])
    );

    expect(decoded.groups[0]!.items.map(point => point.value)).toEqual([-5, 0, 2 ** 40]);
  });

  it('keeps gauge temporality unspecified even when the field is present', () => {
    let gaugeWithTemporality = concat(
      stringField(1, 'g'),
      lengthDelimited(5, concat(lengthDelimited(1, doubleField(4, 1)), varintField(2, 2)))
    );

    let decoded = decodeMetricsProtobuf(
      lengthDelimited(1, lengthDelimited(2, lengthDelimited(2, gaugeWithTemporality)))
    );

    expect(decoded.groups[0]!.items[0]).toMatchObject({
      temporality: 'unspecified',
      value: 1
    });
  });

  it('yields nothing for a metric without data', () => {
    let decoded = decodeMetricsProtobuf(
      lengthDelimited(1, lengthDelimited(2, lengthDelimited(2, stringField(1, 'empty'))))
    );

    expect(decoded.itemCount).toBe(0);
    expect(decoded.groups[0]?.items).toEqual([]);
  });

  it('treats a gauge point with no value as null', () => {
    let decoded = decodeMetricsProtobuf(
      encodeMetricsRequest([{ items: [{ name: 'm', shape: 'gauge', points: [{}] }] }])
    );

    expect(decoded.groups[0]!.items[0]!.value).toBeNull();
  });

  it('counts a malformed metric once', () => {
    let bad = concat(stringField(1, 'bad'), lengthDelimited(5, Uint8Array.from([0x0a, 0x7f])));
    let good = encodeMetricsRequest([
      { items: [{ name: 'good', shape: 'gauge', points: [{ asDouble: 1 }] }] }
    ]);

    let decoded = decodeMetricsProtobuf(
      concat(lengthDelimited(1, lengthDelimited(2, lengthDelimited(2, bad))), good)
    );

    expect(decoded.malformed).toBe(1);
    expect(decoded.itemCount).toBe(1);
  });
});

describe('decodeTracesProtobuf', () => {
  it('decodes spans with events and status', () => {
    let decoded = decodeTracesProtobuf(encodeTracesRequest(traceGroups));

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
    expect(span?.events[0]).toMatchObject({
      timeNs: 1_781_524_801_000_000_000n,
      name: 'gen_ai.content.prompt'
    });
    expect({ ...span?.events[0]?.attributes }).toEqual({ 'gen_ai.prompt': 'hi' });
    expect(bare).toMatchObject({ name: 'bare', events: [], statusCode: 0 });
  });

  it('caps events per span', () => {
    let events = Array.from({ length: 600 }, (_, i) => ({ name: `e${i}` }));

    let decoded = decodeTracesProtobuf(
      encodeTracesRequest([{ items: [{ name: 's', events }] }])
    );

    expect(decoded.groups[0]!.items[0]!.events).toHaveLength(otlpLimits.maxArrayLength);
  });
});

describe('decodeOtlp', () => {
  it('dispatches on signal and payload type', () => {
    expect(decodeOtlp('logs', 'protobuf', encodeLogsRequest(logGroups)).itemCount).toBe(3);
    expect(
      decodeOtlp('metrics', 'protobuf', encodeMetricsRequest(metricGroups)).itemCount
    ).toBe(6);
    expect(decodeOtlp('traces', 'protobuf', encodeTracesRequest(traceGroups)).itemCount).toBe(
      2
    );

    let json = new TextEncoder().encode('{"resourceLogs":[]}');

    expect(decodeOtlp('logs', 'json', json).itemCount).toBe(0);
    expect(decodeOtlp('metrics', 'json', new TextEncoder().encode('{}')).itemCount).toBe(0);
    expect(decodeOtlp('traces', 'json', new TextEncoder().encode('{}')).itemCount).toBe(0);
  });

  it('treats an undefined or non-json payload type as protobuf', () => {
    let payload = encodeLogsRequest(logGroups);

    expect(decodeOtlp('logs', undefined, payload).itemCount).toBe(3);
    expect(decodeOtlp('logs', 'ndjson', payload).itemCount).toBe(3);
  });

  it('does not decode json bytes as protobuf', () => {
    let error = errorOf(() =>
      decodeOtlp('logs', 'protobuf', new TextEncoder().encode('{"resourceLogs":[]}'))
    );

    expect(error).toBeInstanceOf(OtlpDecodeError);
  });
});
