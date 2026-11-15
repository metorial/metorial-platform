import { afterEach, describe, expect, it } from 'vitest';
import { setRuntime } from '@mtsrc/agent-tracking-module-ingest';
import { setRecordSink } from '@mtsrc/agent-tracking-module-records';
import { createPipeline, errorBody, fixedNow } from './pipeline';

let sentinel = 'SENTINEL-otlp-91bc';

let nowNs = String(fixedNow.getTime() * 1_000_000);

let nsAgo = (ms: number) => String((fixedNow.getTime() - ms) * 1_000_000);

let value = (input: unknown): Record<string, unknown> => {
  if (typeof input == 'string') return { stringValue: input };
  if (typeof input == 'boolean') return { boolValue: input };
  if (typeof input == 'number') {
    return Number.isInteger(input) ? { intValue: String(input) } : { doubleValue: input };
  }
  if (Array.isArray(input)) return { arrayValue: { values: input.map(value) } };

  return {
    kvlistValue: {
      values: Object.entries(input as Record<string, unknown>).map(([key, entry]) => ({
        key,
        value: value(entry)
      }))
    }
  };
};

let attributes = (input: Record<string, unknown>) =>
  Object.entries(input).map(([key, entry]) => ({ key, value: value(entry) }));

let resource = (service: string, extra: Record<string, unknown> = {}) => ({
  attributes: attributes({ 'service.name': service, ...extra })
});

let claudeResource = resource('claude-code');

let promptLog = (
  overrides: Record<string, unknown> = {},
  extra: Record<string, unknown> = {}
) => ({
  timeUnixNano: nowNs,
  body: { stringValue: 'claude_code.user_prompt' },
  attributes: attributes({
    'event.name': 'user_prompt',
    'session.id': 'session-1',
    'prompt.id': 'prompt-1',
    prompt_length: 12,
    prompt: `hello ${sentinel}`,
    ...extra
  }),
  ...overrides
});

let logsBody = (
  logs: unknown[],
  res: unknown = claudeResource,
  scope = { name: 'com.anthropic.claude_code.events' }
) => ({
  resourceLogs: [{ resource: res, scopeLogs: [{ scope, logRecords: logs }] }]
});

let metricsBody = (metrics: unknown[], res: unknown = claudeResource) => ({
  resourceMetrics: [
    {
      resource: res,
      scopeMetrics: [{ scope: { name: 'com.anthropic.claude_code' }, metrics }]
    }
  ]
});

let tokenMetric = (amount: number, type = 'input', time = nowNs) => ({
  name: 'claude_code.token.usage',
  unit: 'tokens',
  sum: {
    aggregationTemporality: 1,
    isMonotonic: true,
    dataPoints: [
      {
        asInt: String(amount),
        startTimeUnixNano: nsAgo(10_000),
        timeUnixNano: time,
        attributes: attributes({ model: 'claude-sonnet', type, 'session.id': 'session-1' })
      }
    ]
  }
});

let tracesBody = (spans: unknown[], res: unknown = claudeResource) => ({
  resourceSpans: [
    {
      resource: res,
      scopeSpans: [{ scope: { name: 'com.anthropic.claude_code.tracing' }, spans }]
    }
  ]
});

let interactionSpan = (overrides: Record<string, unknown> = {}) => ({
  traceId: 'a'.repeat(32),
  spanId: 'b'.repeat(16),
  name: 'claude_code.interaction',
  kind: 1,
  startTimeUnixNano: nsAgo(5000),
  endTimeUnixNano: nowNs,
  attributes: attributes({ 'session.id': 'session-1', 'prompt.id': 'prompt-1' }),
  status: { code: 1 },
  ...overrides
});

let post = (
  pipeline: ReturnType<typeof createPipeline>,
  path: string,
  body: unknown,
  options: Record<string, unknown> = {}
) =>
  pipeline.send(path, {
    body: typeof body == 'string' ? body : JSON.stringify(body),
    ...options
  });

afterEach(() => {
  setRuntime(undefined);
  setRecordSink(undefined);
});

describe('otlp handler', () => {
  describe('logs', () => {
    it('maps a claude code log into a record', async () => {
      let pipeline = createPipeline();

      let response = await post(pipeline, '/v1/logs', logsBody([promptLog()]));
      let [record] = pipeline.records();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(await response.json()).toEqual({});
      expect(pipeline.records()).toHaveLength(1);
      expect(record!.type).toBe('prompt.submitted');
      expect(record!.source).toMatchObject({
        adapter: 'claude-code',
        dialect: 'claude-code.otlp.v1',
        channel: 'otlp.logs'
      });
      expect(record!.ingest).toMatchObject({ route: 'otlp_http', backfill: false });
      expect(record!.ctx.session_id).toBe('session-1');
    });

    it('uses the log time as event time', async () => {
      let pipeline = createPipeline();

      await post(pipeline, '/v1/logs', logsBody([promptLog({ timeUnixNano: nsAgo(1000) })]));

      let [record] = pipeline.records();

      expect(record!.occurred_at).toBe(new Date(fixedNow.getTime() - 1000).toISOString());
      expect(record!.quality.time_source).toBe('client');
      expect(record!.quality.warnings).not.toContain('clock_skew');
    });

    it('flags clock skew', async () => {
      let pipeline = createPipeline();

      await post(
        pipeline,
        '/v1/logs',
        logsBody([promptLog({ timeUnixNano: nsAgo(3_600_000) })])
      );

      expect(pipeline.records()[0]!.quality.warnings).toContain('clock_skew');
    });

    it('falls back to arrival time without a log time', async () => {
      let pipeline = createPipeline();

      await post(
        pipeline,
        '/v1/logs',
        logsBody([promptLog({ timeUnixNano: undefined, observedTimeUnixNano: undefined })])
      );

      let [record] = pipeline.records();

      expect(record!.quality.warnings).toContain('time_unknown');
      expect(record!.occurred_at).toBe(record!.observed_at);
    });

    it('never stores prompt text in basic mode', async () => {
      let pipeline = createPipeline();

      await post(pipeline, '/v1/logs', logsBody([promptLog()]));

      expect(JSON.stringify(pipeline.records())).not.toContain(sentinel);
    });

    it('keeps prompt text only in content entries in full mode', async () => {
      let pipeline = createPipeline({ contentPolicy: { defaultMode: 'full' } });

      await post(pipeline, '/v1/logs', logsBody([promptLog()]));

      let [record] = pipeline.records();

      expect(record!.content.some(entry => entry.text?.includes(sentinel))).toBe(true);
      expect(JSON.stringify({ ...record, content: [] })).not.toContain(sentinel);
    });

    it('maps codex logs with the codex dialect', async () => {
      let pipeline = createPipeline();

      await post(
        pipeline,
        '/v1/logs',
        logsBody(
          [
            {
              timeUnixNano: nowNs,
              body: { stringValue: 'codex.user_prompt' },
              attributes: attributes({
                'event.name': 'codex.user_prompt',
                'conversation.id': 'conv-1',
                prompt_length: 4,
                prompt: sentinel
              })
            }
          ],
          resource('codex_cli_rs'),
          { name: 'codex_otel.log_only' }
        )
      );

      expect(pipeline.records()[0]!.source.dialect).toBe('codex.otlp.v1');
      expect(JSON.stringify(pipeline.records())).not.toContain(sentinel);
    });

    it('quarantines unknown sources without their attributes', async () => {
      let pipeline = createPipeline();

      let response = await post(
        pipeline,
        '/v1/logs',
        logsBody(
          [
            {
              timeUnixNano: nowNs,
              body: { stringValue: 'something_happened' },
              attributes: attributes({ secret: sentinel })
            }
          ],
          resource('mystery-tool', { 'host.name': sentinel }),
          { name: 'mystery' }
        )
      );

      let [record] = pipeline.records();

      expect(response.status).toBe(200);
      expect(record!.type).toBe('unmapped');
      expect(record!.source.dialect).toBe('quarantine.otlp.v1');
      expect(JSON.stringify(record)).not.toContain(sentinel);
    });

    it('stores several logs and groups in one request', async () => {
      let pipeline = createPipeline();

      let body = {
        resourceLogs: [
          {
            resource: claudeResource,
            scopeLogs: [
              {
                scope: { name: 'com.anthropic.claude_code.events' },
                logRecords: [promptLog(), promptLog({ timeUnixNano: nsAgo(1) })]
              }
            ]
          },
          {
            resource: resource('claude-code', { 'service.version': '2.0.0' }),
            scopeLogs: [
              {
                scope: { name: 'com.anthropic.claude_code.events' },
                logRecords: [promptLog({ timeUnixNano: nsAgo(2) })]
              }
            ]
          }
        ]
      };

      await post(pipeline, '/v1/logs', body);

      expect(pipeline.records()).toHaveLength(3);
    });

    it('accepts an empty export request', async () => {
      let pipeline = createPipeline();

      let response = await post(pipeline, '/v1/logs', {});

      expect(response.status).toBe(200);
      expect(pipeline.records()).toHaveLength(0);
    });

    it('accepts empty resource lists', async () => {
      let pipeline = createPipeline();

      let response = await post(pipeline, '/v1/logs', { resourceLogs: [] });

      expect(response.status).toBe(200);
    });

    it('is idempotent when a request is retried', async () => {
      let pipeline = createPipeline();

      await post(pipeline, '/v1/logs', logsBody([promptLog()]));
      await post(pipeline, '/v1/logs', logsBody([promptLog()]));

      let [first, second] = pipeline.records();

      expect(first!.id).toBe(second!.id);
    });

    it('keeps organizations apart', async () => {
      let first = createPipeline({ organization: { id: 'ator_a' } });
      await post(first, '/v1/logs', logsBody([promptLog()]));
      let firstId = first.records()[0]!.id;

      let second = createPipeline({ organization: { id: 'ator_b' } });
      await post(second, '/v1/logs', logsBody([promptLog()]));

      expect(second.records()[0]!.id).not.toBe(firstId);
    });
  });

  describe('metrics', () => {
    it('maps a token usage metric into a measurement', async () => {
      let pipeline = createPipeline();

      let response = await post(pipeline, '/v1/metrics', metricsBody([tokenMetric(42)]));
      let [record] = pipeline.records();

      expect(response.status).toBe(200);
      expect(pipeline.records()).toHaveLength(1);
      expect(record!.kind).toBe('measurement');
      expect(record!.source.channel).toBe('otlp.metrics');
    });

    it('creates distinct records for distinct points', async () => {
      let pipeline = createPipeline();

      await post(
        pipeline,
        '/v1/metrics',
        metricsBody([
          tokenMetric(1, 'input'),
          tokenMetric(2, 'output'),
          tokenMetric(3, 'input', nsAgo(5))
        ])
      );

      expect(new Set(pipeline.records().map(record => record.id)).size).toBe(3);
    });

    it('suppresses metrics the dialect does not know', async () => {
      let pipeline = createPipeline();

      let response = await post(
        pipeline,
        '/v1/metrics',
        metricsBody([
          {
            name: 'claude_code.something.new',
            gauge: { dataPoints: [{ asInt: '1', timeUnixNano: nowNs }] }
          }
        ])
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({});
      expect(pipeline.records()).toHaveLength(0);
    });

    it('does not store attribute values in measurements', async () => {
      let pipeline = createPipeline();
      let metric = tokenMetric(5);

      metric.sum.dataPoints[0]!.attributes.push({
        key: 'secret',
        value: { stringValue: sentinel }
      });

      await post(pipeline, '/v1/metrics', metricsBody([metric]));

      expect(JSON.stringify(pipeline.records())).not.toContain(sentinel);
    });
  });

  describe('traces', () => {
    it('maps an interaction span', async () => {
      let pipeline = createPipeline();

      let response = await post(pipeline, '/v1/traces', tracesBody([interactionSpan()]));
      let [record] = pipeline.records();

      expect(response.status).toBe(200);
      expect(record!.type).toBe('turn.completed');
      expect(record!.source.channel).toBe('otlp.traces');
      expect(record!.ctx.trace).toMatchObject({
        trace_id: 'a'.repeat(32),
        span_id: 'b'.repeat(16)
      });
    });

    it('computes the duration from span times', async () => {
      let pipeline = createPipeline();

      await post(pipeline, '/v1/traces', tracesBody([interactionSpan()]));

      expect(pipeline.records()[0]!.duration_ms).toBe(5000);
    });

    it('is idempotent for the same span', async () => {
      let pipeline = createPipeline();

      await post(pipeline, '/v1/traces', tracesBody([interactionSpan()]));
      await post(pipeline, '/v1/traces', tracesBody([interactionSpan()]));

      let [first, second] = pipeline.records();

      expect(first!.id).toBe(second!.id);
    });
  });

  describe('signal inference on /v1/otlp', () => {
    it.each([
      ['logs', logsBody([promptLog()]), 'otlp.logs'],
      ['metrics', metricsBody([tokenMetric(1)]), 'otlp.metrics'],
      ['traces', tracesBody([interactionSpan()]), 'otlp.traces']
    ])('detects %s', async (_signal, body, channel) => {
      let pipeline = createPipeline();

      let response = await post(pipeline, '/v1/otlp', body);

      expect(response.status).toBe(200);
      expect(pipeline.records()[0]!.source.channel).toBe(channel);
    });

    it('rejects payloads with several signals', async () => {
      let pipeline = createPipeline();

      let response = await post(pipeline, '/v1/otlp', {
        ...logsBody([promptLog()]),
        ...metricsBody([tokenMetric(1)])
      });

      expect(response.status).toBe(400);
      expect((await errorBody(response)).code).toBe('invalid_payload');
      expect(pipeline.records()).toHaveLength(0);
    });

    it.each([{}, { other: [] }, [], { resourceLogs: [], resourceSpans: [] }])(
      'rejects the payload %j',
      async body => {
        let pipeline = createPipeline();

        let response = await post(pipeline, '/v1/otlp', body);

        expect(response.status).toBe(400);
      }
    );

    it('rejects protobuf on the combined route', async () => {
      let pipeline = createPipeline();

      let response = await pipeline.send('/v1/otlp', {
        contentType: 'application/x-protobuf',
        body: new Uint8Array([10, 0])
      });

      expect(response.status).toBe(400);
      expect((await errorBody(response)).code).toBe('invalid_payload');
    });

    it('checks the channel of the detected signal', async () => {
      let pipeline = createPipeline({ allowedChannels: ['otlp.metrics'] });

      let response = await post(pipeline, '/v1/otlp', logsBody([promptLog()]));

      expect(response.status).toBe(403);
      expect((await errorBody(response)).code).toBe('channel_not_allowed');
      expect(pipeline.records()).toHaveLength(0);
    });

    it('allows the signal a token is scoped to', async () => {
      let pipeline = createPipeline({ allowedChannels: ['otlp.logs'] });

      let response = await post(pipeline, '/v1/otlp', logsBody([promptLog()]));

      expect(response.status).toBe(200);
    });
  });

  describe('authorization', () => {
    it('rejects tokens without the logs channel', async () => {
      let pipeline = createPipeline({ allowedChannels: ['otlp.traces'] });

      let response = await post(pipeline, '/v1/logs', logsBody([promptLog()]));

      expect(response.status).toBe(403);
      expect((await errorBody(response)).code).toBe('channel_not_allowed');
    });

    it('rejects everything when no item client is allowed', async () => {
      let pipeline = createPipeline({ allowedClients: ['codex'] });

      let response = await post(pipeline, '/v1/logs', logsBody([promptLog()]));

      expect(response.status).toBe(403);
      expect((await errorBody(response)).code).toBe('client_not_allowed');
      expect(pipeline.records()).toHaveLength(0);
    });

    it('reports a partial success when only some clients are allowed', async () => {
      let pipeline = createPipeline({ allowedClients: ['claude-code'] });

      let body = {
        resourceLogs: [
          ...logsBody([promptLog()]).resourceLogs,
          ...logsBody(
            [{ timeUnixNano: nowNs, body: { stringValue: 'x' }, attributes: [] }],
            resource('other-tool'),
            { name: 'other' }
          ).resourceLogs
        ]
      };

      let response = await post(pipeline, '/v1/logs', body);
      let result = (await response.json()) as {
        partialSuccess: { rejectedLogRecords: string; errorMessage: string };
      };

      expect(response.status).toBe(200);
      expect(result.partialSuccess.rejectedLogRecords).toBe('1');
      expect(result.partialSuccess.errorMessage).toContain('may not use');
      expect(pipeline.records()).toHaveLength(1);
    });

    it('treats unknown sources as the unknown client', async () => {
      let pipeline = createPipeline({ allowedClients: ['unknown'] });

      let response = await post(
        pipeline,
        '/v1/logs',
        logsBody(
          [{ timeUnixNano: nowNs, body: { stringValue: 'x' } }],
          resource('other-tool'),
          {
            name: 'other'
          }
        )
      );

      expect(response.status).toBe(200);
      expect(pipeline.records()).toHaveLength(1);
    });
  });

  describe('malformed input', () => {
    it.each(['', 'not json', '[]', '"x"', '{', 'null'])('rejects the body %j', async body => {
      let pipeline = createPipeline();

      let response = await post(pipeline, '/v1/logs', body);

      expect(response.status).toBe(400);
      expect((await errorBody(response)).code).toBe('invalid_payload');
    });

    it('rejects invalid utf-8', async () => {
      let pipeline = createPipeline();

      let response = await pipeline.send('/v1/logs', {
        body: new Uint8Array([0x7b, 0x22, 0xff, 0x22, 0x3a, 0x31, 0x7d])
      });

      expect(response.status).toBe(400);
    });

    it('counts malformed log records as rejected and keeps the rest', async () => {
      let pipeline = createPipeline();

      let body = logsBody([
        promptLog(),
        'garbage',
        null,
        12,
        promptLog({ timeUnixNano: nsAgo(7) })
      ]);
      let response = await post(pipeline, '/v1/logs', body);
      let result = (await response.json()) as {
        partialSuccess?: { rejectedLogRecords: string };
      };

      expect(response.status).toBe(200);
      expect(pipeline.records()).toHaveLength(2);
      expect(result.partialSuccess?.rejectedLogRecords).toBe('3');
    });

    it('never echoes payload values in error messages', async () => {
      let pipeline = createPipeline();

      let response = await post(pipeline, '/v1/logs', `{"resourceLogs": "${sentinel}"`);

      expect(await response.text()).not.toContain(sentinel);
    });

    it('survives deeply nested attribute values', async () => {
      let pipeline = createPipeline();

      let nested: unknown = 'leaf';
      for (let i = 0; i < 200; i++)
        nested = { kvlistValue: { values: [{ key: 'k', value: nested }] } };

      let response = await post(
        pipeline,
        '/v1/logs',
        logsBody([
          {
            timeUnixNano: nowNs,
            body: { stringValue: 'x' },
            attributes: [{ key: 'deep', value: nested }]
          }
        ])
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        partialSuccess: { rejectedLogRecords: '1' }
      });
      expect(pipeline.records()).toHaveLength(0);
    });

    it('survives hostile attribute keys', async () => {
      let pipeline = createPipeline();

      let response = await post(
        pipeline,
        '/v1/logs',
        logsBody([
          promptLog({}, {
            __proto__: 'x',
            constructor: 'y',
            prototype: 'z',
            'a.b.c': 1
          } as Record<string, unknown>)
        ])
      );

      expect(response.status).toBe(200);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('survives records with thousands of attributes', async () => {
      let pipeline = createPipeline();
      let many: Record<string, unknown> = {};
      for (let i = 0; i < 5000; i++) many[`attribute_${i}`] = i;

      let response = await post(pipeline, '/v1/logs', logsBody([promptLog({}, many)]));

      expect(response.status).toBe(200);
      expect(JSON.stringify(pipeline.records()).length).toBeLessThan(200_000);
    });
  });

  describe('limits', () => {
    let tinyLogs = (count: number) =>
      logsBody(
        Array.from({ length: count }, (_, index) => ({
          timeUnixNano: String(BigInt(nowNs) - BigInt(index)),
          body: { stringValue: 'x' }
        })),
        resource('limit-tool'),
        { name: 'limits' }
      );

    it('accepts exactly the item limit', async () => {
      let pipeline = createPipeline();

      let response = await post(pipeline, '/v1/logs', tinyLogs(20_000));

      expect(response.status).toBe(200);
      expect(pipeline.records()).toHaveLength(20_000);
    });

    it('rejects more items than the limit without writing anything', async () => {
      let pipeline = createPipeline();

      let response = await post(pipeline, '/v1/logs', tinyLogs(20_001));

      expect(response.status).toBe(413);
      expect((await errorBody(response)).code).toBe('too_many_items');
      expect(pipeline.records()).toHaveLength(0);
    });

    it('rejects oversized bodies', async () => {
      let pipeline = createPipeline();

      let response = await post(
        pipeline,
        '/v1/logs',
        `{"filler":"${'a'.repeat(5 * 1024 * 1024)}"}`
      );

      expect(response.status).toBe(413);
    });

    it('accepts gzip bodies', async () => {
      let pipeline = createPipeline();

      let response = await post(pipeline, '/v1/logs', logsBody([promptLog()]), { gzip: true });

      expect(response.status).toBe(200);
      expect(pipeline.records()).toHaveLength(1);
    });

    it('rejects unsupported content types', async () => {
      let pipeline = createPipeline();

      let response = await post(pipeline, '/v1/logs', '{}', { contentType: 'text/plain' });

      expect(response.status).toBe(415);
    });
  });

  describe('sink failures', () => {
    it('answers 503 with Retry-After when the sink is busy', async () => {
      let pipeline = createPipeline();
      pipeline.sink.setBusy(true);

      let response = await post(pipeline, '/v1/logs', logsBody([promptLog()]));

      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('5');
    });

    it('answers 500 without leaking the failure', async () => {
      let pipeline = createPipeline();
      pipeline.sink.failNext(new Error(`boom ${sentinel}`));

      let response = await post(pipeline, '/v1/logs', logsBody([promptLog()]));

      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain(sentinel);
    });
  });
});
