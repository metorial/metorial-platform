import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { setRuntime } from '@mtsrc/agent-tracking-module-ingest';
import { setRecordSink } from '@mtsrc/agent-tracking-module-records';
import { createPipeline, errorBody } from './pipeline';
import { nanosOf, otlpAt } from '@mtsrc/agent-tracking-otlp/test/otlp';
import {
  concat,
  encodeLogsRequest,
  encodeMetricsRequest,
  encodeTracesRequest,
  jsonBytes,
  lengthDelimited,
  logsJson,
  metricsJson,
  tracesJson,
  varintField,
  type Group,
  type LogDesc,
  type MetricDesc,
  type SpanDesc
} from '@mtsrc/agent-tracking-testing';

let sentinel = 'SENTINEL-otlp-pb-77d1';

let protobuf = 'application/x-protobuf';

let claude = { resource: { attributes: { 'service.name': 'claude-code' } } };

let promptGroup = (extra: Partial<LogDesc> = {}): Group<LogDesc> => ({
  ...claude,
  scope: { name: 'com.anthropic.claude_code.events' },
  items: [
    {
      timeNs: nanosOf(otlpAt),
      body: 'claude_code.user_prompt',
      attributes: {
        'event.name': 'user_prompt',
        'session.id': 'session-1',
        prompt_length: 12,
        prompt: `hello ${sentinel}`
      },
      ...extra
    }
  ]
});

let tokenGroup = (): Group<MetricDesc> => ({
  ...claude,
  scope: { name: 'com.anthropic.claude_code' },
  items: [
    {
      name: 'claude_code.token.usage',
      unit: 'tokens',
      shape: 'sum',
      temporality: 'delta',
      monotonic: true,
      points: [
        {
          startNs: nanosOf('2026-06-15T11:59:00.000Z'),
          timeNs: nanosOf(otlpAt),
          asInt: 42,
          attributes: { model: 'claude-sonnet', type: 'input', 'session.id': 'session-1' }
        }
      ]
    }
  ]
});

let spanGroup = (): Group<SpanDesc> => ({
  ...claude,
  scope: { name: 'com.anthropic.claude_code.tracing' },
  items: [
    {
      traceId: 'a'.repeat(32),
      spanId: 'b'.repeat(16),
      name: 'claude_code.interaction',
      kind: 1,
      startNs: nanosOf('2026-06-15T11:59:28.000Z'),
      endNs: nanosOf(otlpAt),
      attributes: { 'session.id': 'session-1', 'prompt.id': 'prompt-1' },
      status: { code: 1 }
    }
  ]
});

let post = (
  pipeline: ReturnType<typeof createPipeline>,
  path: string,
  body: Uint8Array,
  options: { gzip?: boolean; contentType?: string } = {}
) =>
  pipeline.send(path, {
    body,
    contentType: options.contentType ?? protobuf,
    gzip: options.gzip
  });

let comparable = (records: ReturnType<ReturnType<typeof createPipeline>['records']>) =>
  JSON.parse(
    JSON.stringify(records, (key, value) => (key == 'request_id' ? undefined : value))
  );

afterEach(() => {
  setRuntime(undefined);
  setRecordSink(undefined);
});

describe('otlp handler (protobuf)', () => {
  it('maps a protobuf log export and answers with an empty protobuf body', async () => {
    let pipeline = createPipeline();

    let response = await post(pipeline, '/v1/logs', encodeLogsRequest([promptGroup()]));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(protobuf);
    expect(new Uint8Array(await response.arrayBuffer())).toHaveLength(0);

    let [record] = pipeline.records();

    expect(pipeline.records()).toHaveLength(1);
    expect(record!.type).toBe('prompt.submitted');
    expect(record!.source.channel).toBe('otlp.logs');
    expect(record!.ctx.session_id).toBe('session-1');
  });

  it('never stores prompt text in basic mode', async () => {
    let pipeline = createPipeline();

    await post(pipeline, '/v1/logs', encodeLogsRequest([promptGroup()]));

    expect(JSON.stringify(pipeline.records())).not.toContain(sentinel);
  });

  it('keeps prompt text only in content entries in full mode', async () => {
    let pipeline = createPipeline({ contentPolicy: { defaultMode: 'full' } });

    await post(pipeline, '/v1/logs', encodeLogsRequest([promptGroup()]));

    let [record] = pipeline.records();

    expect(record!.content.some(entry => entry.text?.includes(sentinel))).toBe(true);
    expect(JSON.stringify({ ...record, content: [] })).not.toContain(sentinel);
  });

  it('maps metrics and traces', async () => {
    let pipeline = createPipeline();

    let metrics = await post(pipeline, '/v1/metrics', encodeMetricsRequest([tokenGroup()]));
    let traces = await post(pipeline, '/v1/traces', encodeTracesRequest([spanGroup()]));

    expect(metrics.status).toBe(200);
    expect(traces.status).toBe(200);
    expect(metrics.headers.get('content-type')).toContain(protobuf);
    expect(traces.headers.get('content-type')).toContain(protobuf);

    expect(pipeline.records().some(record => record.kind == 'measurement')).toBe(true);
    expect(pipeline.records().length).toBeGreaterThanOrEqual(2);
  });

  it('produces the same records as the equivalent JSON export', async () => {
    let groups = [promptGroup()];
    let viaProtobuf = createPipeline();
    let viaJson = createPipeline();

    await post(viaProtobuf, '/v1/logs', encodeLogsRequest(groups));
    await viaJson.send('/v1/logs', { body: jsonBytes(logsJson(groups)) });

    expect(viaProtobuf.records().length).toBeGreaterThan(0);
    expect(comparable(viaProtobuf.records())).toEqual(comparable(viaJson.records()));
  });

  it('produces the same metric records as the equivalent JSON export', async () => {
    let groups = [tokenGroup()];
    let viaProtobuf = createPipeline();
    let viaJson = createPipeline();

    await post(viaProtobuf, '/v1/metrics', encodeMetricsRequest(groups));
    await viaJson.send('/v1/metrics', { body: jsonBytes(metricsJson(groups)) });

    expect(comparable(viaProtobuf.records())).toEqual(comparable(viaJson.records()));
  });

  it('produces the same span records as the equivalent JSON export', async () => {
    let groups = [spanGroup()];
    let viaProtobuf = createPipeline();
    let viaJson = createPipeline();

    await post(viaProtobuf, '/v1/traces', encodeTracesRequest(groups));
    await viaJson.send('/v1/traces', { body: jsonBytes(tracesJson(groups)) });

    expect(comparable(viaProtobuf.records())).toEqual(comparable(viaJson.records()));
  });

  it('is idempotent for a resent export', async () => {
    let pipeline = createPipeline();
    let body = encodeLogsRequest([promptGroup()]);

    await post(pipeline, '/v1/logs', body);
    await post(pipeline, '/v1/logs', body);

    expect(new Set(pipeline.records().map(record => record.id)).size).toBe(1);
  });

  it('accepts gzip-compressed bodies', async () => {
    let pipeline = createPipeline();

    let response = await post(pipeline, '/v1/logs', encodeLogsRequest([promptGroup()]), {
      gzip: true
    });

    expect(response.status).toBe(200);
    expect(pipeline.records()).toHaveLength(1);
  });

  it('accepts an empty body as an empty export', async () => {
    let pipeline = createPipeline();

    for (let path of ['/v1/logs', '/v1/metrics', '/v1/traces']) {
      let response = await post(pipeline, path, new Uint8Array());

      expect(response.status, path).toBe(200);
      expect(response.headers.get('content-type'), path).toContain(protobuf);
    }

    expect(pipeline.records()).toHaveLength(0);
  });

  it('answers partial success in protobuf when some logs are not allowed', async () => {
    let pipeline = createPipeline({ allowedClients: ['claude-code'] });

    let codex: Group<LogDesc> = {
      resource: { attributes: { 'service.name': 'codex_cli_rs' } },
      scope: { name: 'codex' },
      items: [
        {
          timeNs: nanosOf(otlpAt),
          body: 'x',
          attributes: { 'event.name': 'codex.user_prompt' }
        }
      ]
    };

    let response = await post(pipeline, '/v1/logs', encodeLogsRequest([promptGroup(), codex]));
    let bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(protobuf);

    expect(bytes[0]).toBe(0x0a);
    expect(Buffer.from(bytes).includes(Buffer.from('may not use'))).toBe(true);
    expect(pipeline.records()).toHaveLength(1);
  });

  it('rejects an export for clients the token may not use', async () => {
    let pipeline = createPipeline({ allowedClients: ['codex'] });

    let response = await post(pipeline, '/v1/logs', encodeLogsRequest([promptGroup()]));

    expect(response.status).toBe(403);
    expect((await errorBody(response)).code).toBe('client_not_allowed');
    expect(pipeline.records()).toHaveLength(0);
  });

  it('rejects protobuf on the signal-inferring route', async () => {
    let pipeline = createPipeline();

    let response = await post(pipeline, '/v1/otlp', encodeLogsRequest([promptGroup()]));

    expect(response.status).toBe(400);
    expect((await errorBody(response)).code).toBe('invalid_payload');
    expect(pipeline.records()).toHaveLength(0);
  });

  describe('malformed input', () => {
    it('rejects truncated messages without storing anything', async () => {
      let pipeline = createPipeline();
      let body = encodeLogsRequest([promptGroup()]);

      for (let cut of [1, 3, Math.floor(body.length / 2), body.length - 1]) {
        let response = await post(pipeline, '/v1/logs', body.slice(0, cut));

        expect(response.status, `cut ${cut}`).toBe(400);
        expect((await errorBody(response)).code).toBe('invalid_payload');
      }

      expect(pipeline.records()).toHaveLength(0);
    });

    it('rejects random garbage with a 400 and never a 500', async () => {
      let pipeline = createPipeline();

      for (let seed = 1; seed <= 25; seed++) {
        let bytes = new Uint8Array(64);

        for (let i = 0; i < bytes.length; i++)
          bytes[i] = (seed * 31 + i * 17 + (i >> 2)) & 0xff;

        let response = await post(pipeline, '/v1/logs', bytes);

        expect([200, 400], `seed ${seed}`).toContain(response.status);
      }
    });

    it('rejects a length prefix that overruns the buffer', async () => {
      let pipeline = createPipeline();

      let response = await post(
        pipeline,
        '/v1/logs',
        Uint8Array.from([0x0a, 0xff, 0xff, 0xff, 0x0f, 0x01])
      );

      expect(response.status).toBe(400);
    });

    it('rejects deeply nested values without crashing', async () => {
      let pipeline = createPipeline();
      let nested: Uint8Array = varintField(1, 1);

      for (let depth = 0; depth < 500; depth++) nested = lengthDelimited(1, nested);

      let response = await post(pipeline, '/v1/logs', concat(nested));

      expect([200, 400]).toContain(response.status);
      expect(pipeline.records()).toHaveLength(0);
    });

    it('rejects a gzip bomb', async () => {
      let pipeline = createPipeline();
      let bomb = gzipSync(new Uint8Array(64 * 1024 * 1024));

      let response = await pipeline.send('/v1/logs', {
        body: bomb,
        contentType: protobuf,
        headers: { 'content-encoding': 'gzip' }
      });

      expect(response.status).toBe(413);
    });
  });

  describe('limits', () => {
    it('accepts 20_000 records and rejects 20_001', async () => {
      let items = (count: number): LogDesc[] =>
        Array.from({ length: count }, (_, i) => ({
          timeNs: nanosOf(otlpAt),
          body: 'x',
          attributes: { 'event.name': 'user_prompt', 'prompt.id': `p${i}` }
        }));

      let group = (count: number): Group<LogDesc> => ({
        ...claude,
        scope: { name: 'com.anthropic.claude_code.events' },
        items: items(count)
      });

      let ok = createPipeline();
      let over = createPipeline();

      expect((await post(ok, '/v1/logs', encodeLogsRequest([group(20_000)]))).status).toBe(
        200
      );

      let response = await post(over, '/v1/logs', encodeLogsRequest([group(20_001)]));

      expect(response.status).toBe(413);
      expect((await errorBody(response)).code).toBe('too_many_items');
      expect(over.records()).toHaveLength(0);
    });
  });

  it('answers 503 with Retry-After when the sink is busy', async () => {
    let pipeline = createPipeline();

    pipeline.sink.setBusy(true);

    let response = await post(pipeline, '/v1/logs', encodeLogsRequest([promptGroup()]));

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
    expect(pipeline.records()).toHaveLength(0);
  });
});
