import { describe, expect, it } from 'vitest';
import { createToken, errorCode, ingest, instanceRecords, setSinkBusy } from './support';

let nowNanos = () => String(BigInt(Date.now()) * 1_000_000n);

let attr = (key: string, value: string | number) => ({
  key,
  value: typeof value == 'number' ? { intValue: String(value) } : { stringValue: value }
});

let resource = (service: string) => ({ attributes: [attr('service.name', service)] });

let claudeLogs = (overrides: Record<string, unknown> = {}) => ({
  resourceLogs: [
    {
      resource: resource('claude-code'),
      scopeLogs: [
        {
          scope: { name: 'com.anthropic.claude_code.events' },
          logRecords: [
            {
              timeUnixNano: nowNanos(),
              body: { stringValue: 'claude_code.user_prompt' },
              attributes: [
                attr('event.name', 'user_prompt'),
                attr('session.id', 'session-1'),
                attr('prompt_length', 12),
                attr('prompt', 'SENTINEL-e2e-otlp-91ab')
              ]
            }
          ]
        }
      ]
    }
  ],
  ...overrides
});

let claudeMetrics = () => ({
  resourceMetrics: [
    {
      resource: resource('claude-code'),
      scopeMetrics: [
        {
          scope: { name: 'com.anthropic.claude_code' },
          metrics: [
            {
              name: 'claude_code.token.usage',
              sum: {
                aggregationTemporality: 1,
                isMonotonic: true,
                dataPoints: [
                  {
                    timeUnixNano: nowNanos(),
                    asInt: '42',
                    attributes: [attr('type', 'input'), attr('session.id', 'session-1')]
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ]
});

let spans = () => ({
  resourceSpans: [
    {
      resource: resource('claude-code'),
      scopeSpans: [
        {
          scope: { name: 'com.anthropic.claude_code.tracing' },
          spans: [
            {
              traceId: '0af7651916cd43dd8448eb211c80319c',
              spanId: 'b7ad6b7169203331',
              name: 'claude_code.llm_request',
              startTimeUnixNano: nowNanos(),
              endTimeUnixNano: nowNanos(),
              attributes: [attr('session.id', 'session-1')]
            }
          ]
        }
      ]
    }
  ]
});

let send = (
  path: string,
  credential: string,
  body: unknown,
  headers: Record<string, string> = {}
) => ingest(path, { credential, body: JSON.stringify(body), headers });

describe('otlp ingest', () => {
  it('stores log records and mirrors the JSON content type', async () => {
    let { instance, secret } = await createToken();

    let response = await send('/v1/logs', secret, claudeLogs());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({});

    let [stored] = await instanceRecords(instance);

    expect(stored!.record.source.channel).toBe('otlp.logs');
    expect(stored!.record.ingest.route).toBe('otlp_http');
    expect(stored!.record.client.family).toBe('claude-code');
  });

  it('never stores prompt content with the default policy', async () => {
    let { instance, secret } = await createToken();

    await send('/v1/logs', secret, claudeLogs());

    expect(JSON.stringify(await instanceRecords(instance))).not.toContain(
      'SENTINEL-e2e-otlp-91ab'
    );
  });

  it('stores metrics and traces', async () => {
    let { instance, secret } = await createToken();

    let metrics = await send('/v1/metrics', secret, claudeMetrics());
    let traces = await send('/v1/traces', secret, spans());

    expect(metrics.status).toBe(200);
    expect(traces.status).toBe(200);

    let items = await instanceRecords(instance);

    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.some(entry => entry.record.kind == 'measurement')).toBe(true);
  });

  it('is idempotent for a resent export', async () => {
    let { instance, secret } = await createToken();
    let body = claudeLogs();

    await send('/v1/logs', secret, body);
    await send('/v1/logs', secret, body);

    let ids = new Set((await instanceRecords(instance)).map(entry => entry.record.id));

    expect(ids.size).toBe(1);
  });

  it('infers the signal on /v1/otlp', async () => {
    let { instance, secret } = await createToken();

    let response = await send('/v1/otlp', secret, claudeLogs());

    expect(response.status).toBe(200);
    expect(await instanceRecords(instance)).toHaveLength(1);
  });

  it('rejects ambiguous and empty exports on /v1/otlp', async () => {
    let { instance, secret } = await createToken();

    let ambiguous = await send('/v1/otlp', secret, { ...claudeLogs(), ...spans() });
    let empty = await send('/v1/otlp', secret, {});

    expect(ambiguous.status).toBe(400);
    expect(empty.status).toBe(400);
    expect(await instanceRecords(instance)).toHaveLength(0);
  });

  it('answers an empty protobuf export with an empty protobuf response', async () => {
    let { secret } = await createToken();

    let response = await ingest('/v1/logs', {
      credential: secret,
      headers: { 'content-type': 'application/x-protobuf' },
      body: new Uint8Array()
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/x-protobuf');
  });

  it('rejects malformed JSON', async () => {
    let { secret } = await createToken();

    let response = await ingest('/v1/logs', { credential: secret, body: '{' });

    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe('invalid_payload');
  });

  it('enforces the allowed clients of the token', async () => {
    let { instance, secret } = await createToken({ allowedClients: ['codex'] });

    let response = await send('/v1/logs', secret, claudeLogs());

    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe('client_not_allowed');
    expect(await instanceRecords(instance)).toHaveLength(0);
  });

  it('enforces the allowed channels of the token', async () => {
    let { secret } = await createToken({ allowedChannels: ['hook'] });

    let response = await send('/v1/logs', secret, claudeLogs());

    expect(response.status).toBe(403);
  });

  it('reports partial success for allowed and disallowed clients in one export', async () => {
    let { instance, secret } = await createToken({ allowedClients: ['claude-code'] });

    let mixed = claudeLogs();

    mixed.resourceLogs.push({
      resource: resource('codex_cli_rs'),
      scopeLogs: [
        {
          scope: { name: 'codex' },
          logRecords: [
            {
              timeUnixNano: nowNanos(),
              body: { stringValue: 'x' },
              attributes: [attr('event.name', 'codex.user_prompt')]
            }
          ]
        }
      ]
    } as never);

    let response = await send('/v1/logs', secret, mixed);
    let body = (await response.json()) as { partialSuccess?: { rejectedLogRecords: string } };

    expect(response.status).toBe(200);
    expect(body.partialSuccess?.rejectedLogRecords).toBe('1');
    expect(await instanceRecords(instance)).toHaveLength(1);
  });

  it('answers 503 and stores nothing while the sink is busy', async () => {
    let { instance, secret } = await createToken();

    await setSinkBusy(true);

    try {
      let response = await send('/v1/logs', secret, claudeLogs());

      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('5');
    } finally {
      await setSinkBusy(false);
    }

    expect(await instanceRecords(instance)).toHaveLength(0);
  });

  it('keeps records of different instances apart', async () => {
    let first = await createToken();
    let second = await createToken();

    await send('/v1/logs', first.secret, claudeLogs());

    expect(await instanceRecords(first.instance)).toHaveLength(1);
    expect(await instanceRecords(second.instance)).toHaveLength(0);
  });
});
