import { describe, expect, it } from 'vitest';
import { decodeLogsJson, decodeMetricsJson, decodeTracesJson } from '../src/json';
import {
  decodeLogsProtobuf,
  decodeMetricsProtobuf,
  decodeTracesProtobuf
} from '../src/protobuf';
import {
  encodeLogsRequest,
  encodeMetricsRequest,
  encodeTracesRequest,
  jsonBytes,
  logsJson,
  metricsJson,
  tracesJson
} from '@mtsrc/agent-tracking-testing';
import { logGroups, metricGroups, traceGroups } from './fixtures';

let normalize = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(value, (_key, inner) => (typeof inner == 'bigint' ? `${inner}n` : inner))
  );

describe('JSON and protobuf decoders agree', () => {
  it('on logs', () => {
    let json = decodeLogsJson(jsonBytes(logsJson(logGroups)));
    let protobuf = decodeLogsProtobuf(encodeLogsRequest(logGroups));

    expect(normalize(json)).toEqual(normalize(protobuf));
  });

  it('on metrics', () => {
    let json = decodeMetricsJson(jsonBytes(metricsJson(metricGroups)));
    let protobuf = decodeMetricsProtobuf(encodeMetricsRequest(metricGroups));

    expect(normalize(json)).toEqual(normalize(protobuf));
  });

  it('on traces', () => {
    let json = decodeTracesJson(jsonBytes(tracesJson(traceGroups)));
    let protobuf = decodeTracesProtobuf(encodeTracesRequest(traceGroups));

    expect(normalize(json)).toEqual(normalize(protobuf));
  });
});
