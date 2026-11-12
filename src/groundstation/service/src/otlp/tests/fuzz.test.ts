import { isServiceError } from '@lowerdeck/error';
import { describe, expect, it } from 'vitest';
import { decodeLogsJson, decodeMetricsJson, decodeTracesJson } from '../json';
import { OtlpDecodeError, otlpLimits, type OtlpDecoded } from '../model';
import { decodeLogsProtobuf, decodeMetricsProtobuf, decodeTracesProtobuf } from '../protobuf';
import { createRandom, type Random } from '../../test/random';
import {
  encodeLogsRequest,
  encodeMetricsRequest,
  encodeTracesRequest,
  jsonBytes,
  logsJson,
  metricsJson,
  tracesJson
} from '../../test/protobuf';
import { logGroups, metricGroups, traceGroups } from './fixtures';

let mutate = (source: Uint8Array, random: Random): Uint8Array => {
  let bytes = Array.from(source);
  let operations = 1 + random.int(4);

  for (let i = 0; i < operations; i++) {
    let at = bytes.length == 0 ? 0 : random.int(bytes.length);

    switch (random.int(8)) {
      case 0:
        if (bytes.length) bytes[at] = bytes[at]! ^ (1 << random.int(8));
        break;
      case 1:
        bytes = bytes.slice(0, at);
        break;
      case 2:
        bytes.splice(
          at,
          0,
          ...Array.from({ length: 1 + random.int(8) }, () => random.int(256))
        );
        break;
      case 3:
        bytes.splice(at, 1 + random.int(16));
        break;
      case 4:
        if (bytes.length) bytes[at] = 0xff;
        break;
      case 5:
        bytes.splice(at, 0, ...bytes.slice(at, at + 1 + random.int(32)));
        break;
      case 6:
        if (bytes.length) bytes[at] = random.int(256);
        break;
      default:
        bytes.splice(at, 0, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x01);
    }
  }

  return Uint8Array.from(bytes);
};

let randomBytes = (random: Random) =>
  Uint8Array.from({ length: random.int(200) }, () => random.int(256));

let checkOutcome = (run: () => OtlpDecoded<unknown>) => {
  let result: OtlpDecoded<unknown> | undefined;

  try {
    result = run();
  } catch (error) {
    expect(
      error instanceof OtlpDecodeError || isServiceError(error),
      `unexpected error: ${String(error)}`
    ).toBe(true);

    return;
  }

  expect(result.itemCount).toBeGreaterThanOrEqual(0);
  expect(result.itemCount).toBeLessThanOrEqual(otlpLimits.maxItems);
  expect(result.malformed).toBeGreaterThanOrEqual(0);

  let counted = result.groups.reduce((sum, group) => sum + group.items.length, 0);

  expect(counted).toBe(result.itemCount);
};

let iterations = 400;

let protobufTargets = [
  ['logs', encodeLogsRequest(logGroups), decodeLogsProtobuf],
  ['metrics', encodeMetricsRequest(metricGroups), decodeMetricsProtobuf],
  ['traces', encodeTracesRequest(traceGroups), decodeTracesProtobuf]
] as const;

let jsonTargets = [
  ['logs', jsonBytes(logsJson(logGroups)), decodeLogsJson],
  ['metrics', jsonBytes(metricsJson(metricGroups)), decodeMetricsJson],
  ['traces', jsonBytes(tracesJson(traceGroups)), decodeTracesJson]
] as const;

describe('protobuf decoders under mutation', () => {
  for (let [signal, valid, decode] of protobufTargets) {
    it(`only throws decode errors for mutated ${signal}`, () => {
      let random = createRandom(0xc0ffee);
      let started = performance.now();

      for (let i = 0; i < iterations; i++) {
        let input = mutate(valid, random);
        checkOutcome(() => decode(input));
      }

      expect(performance.now() - started).toBeLessThan(4000);
    });

    it(`handles random garbage for ${signal}`, () => {
      let random = createRandom(0xbadf00d);

      for (let i = 0; i < iterations; i++) {
        let input = randomBytes(random);
        checkOutcome(() => decode(input));
      }
    });

    it(`handles every truncation of valid ${signal}`, () => {
      for (let cut = 0; cut <= valid.length; cut++) {
        checkOutcome(() => decode(valid.subarray(0, cut)));
      }
    });
  }
});

describe('JSON decoders under mutation', () => {
  for (let [signal, valid, decode] of jsonTargets) {
    it(`only throws decode errors for mutated ${signal}`, () => {
      let random = createRandom(0x5eed);
      let started = performance.now();

      for (let i = 0; i < iterations; i++) {
        let input = mutate(valid, random);
        checkOutcome(() => decode(input));
      }

      expect(performance.now() - started).toBeLessThan(4000);
    });

    it(`handles random garbage for ${signal}`, () => {
      let random = createRandom(0xfeed);

      for (let i = 0; i < iterations; i++) {
        let input = randomBytes(random);
        checkOutcome(() => decode(input));
      }
    });

    it(`handles every truncation of valid ${signal}`, () => {
      for (let cut = 0; cut <= valid.length; cut += 3) {
        checkOutcome(() => decode(valid.subarray(0, cut)));
      }
    });
  }

  it('handles structurally mutated JSON values', () => {
    let random = createRandom(0xabc);

    let values: unknown[] = [
      null,
      true,
      0,
      -1,
      1e999,
      'x',
      '',
      [],
      {},
      [[]],
      { a: {} },
      'NaN'
    ];

    let corrupt = (node: unknown, depth: number): unknown => {
      if (depth > 6) return node;

      if (Array.isArray(node)) return node.map(item => corrupt(item, depth + 1));

      if (node !== null && typeof node == 'object') {
        let copy: Record<string, unknown> = {};

        for (let [key, value] of Object.entries(node)) {
          copy[key] = random.bool(0.15) ? random.pick(values) : corrupt(value, depth + 1);
        }

        return copy;
      }

      return random.bool(0.15) ? random.pick(values) : node;
    };

    for (let [, , decode, source] of [
      ['logs', 0, decodeLogsJson, logsJson(logGroups)],
      ['metrics', 0, decodeMetricsJson, metricsJson(metricGroups)],
      ['traces', 0, decodeTracesJson, tracesJson(traceGroups)]
    ] as const) {
      for (let i = 0; i < 200; i++) {
        let input = jsonBytes(corrupt(source, 0));
        checkOutcome(() => decode(input));
      }
    }
  });
});
