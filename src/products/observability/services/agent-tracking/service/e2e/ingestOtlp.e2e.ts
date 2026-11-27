import { describe, expect, it } from 'vitest';
import {
  createScope,
  createToken,
  errorCode,
  ingest,
  instanceRecords,
  setSinkBusy
} from './support';

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

  it('stores no Codex api request that belongs to no thread', async () => {
    let { instance, secret } = await createToken();

    let apiRequest = (attributes: { key: string; value: unknown }[]) => ({
      timeUnixNano: nowNanos(),
      traceId: '0'.repeat(32),
      spanId: '0'.repeat(16),
      body: { stringValue: 'codex.api_request' },
      attributes: [
        attr('event.name', 'codex.api_request'),
        attr('duration_ms', 120),
        attr('attempt', 1),
        ...attributes
      ]
    });

    let response = await send('/v1/logs', secret, {
      resourceLogs: [
        {
          resource: resource('codex-app-server'),
          scopeLogs: [
            {
              scope: { name: 'codex_otel.log_only' },
              logRecords: [apiRequest([]), apiRequest([attr('conversation.id', 'thread-1')])]
            }
          ]
        }
      ]
    });

    expect(response.status).toBe(200);

    let stored = await instanceRecords(instance);

    expect(stored).toHaveLength(1);
    expect(stored[0]!.record).toMatchObject({
      type: 'model.request',
      ctx: { session_id: 'thread-1' }
    });
  });

  it('keeps records of different instances apart', async () => {
    let first = await createToken();
    let second = await createToken();

    await send('/v1/logs', first.secret, claudeLogs());

    expect(await instanceRecords(first.instance)).toHaveLength(1);
    expect(await instanceRecords(second.instance)).toHaveLength(0);
  });
});

describe('otlp ingest with Desktop reporting settings', () => {
  let sentinel = 'SENTINEL-e2e-tool-details-4c1e';
  let sha = '06de4d4304e317c123c4bbb07394249ed0cde401';

  let toolLogs = () => ({
    resourceLogs: [
      {
        resource: resource('claude-code'),
        scopeLogs: [
          {
            scope: { name: 'com.anthropic.claude_code.events' },
            logRecords: [
              {
                timeUnixNano: nowNanos(),
                body: { stringValue: 'claude_code.tool_result' },
                attributes: [
                  attr('event.name', 'tool_result'),
                  attr('session.id', 'session-tools'),
                  attr('tool_use_id', 'tool-commit'),
                  attr('tool_name', 'Bash'),
                  attr('success', 'true'),
                  attr(
                    'tool_parameters',
                    JSON.stringify({
                      full_command: `git commit -m "${sentinel}"`,
                      git_commit_id: sha,
                      git_branch: 'feature/MT-7-notes'
                    })
                  ),
                  attr(
                    'tool_input',
                    JSON.stringify({ command: `git commit -m "${sentinel}"` })
                  ),
                  attr('vcs.ref.head.name', 'feature/MT-7-notes'),
                  attr('vcs.ref.head.revision', sha),
                  attr('vcs.ref.head.type', 'branch')
                ]
              },
              {
                timeUnixNano: nowNanos(),
                body: { stringValue: 'claude_code.tool_result' },
                attributes: [
                  attr('event.name', 'tool_result'),
                  attr('session.id', 'session-tools'),
                  attr('tool_use_id', 'tool-mcp'),
                  attr('tool_name', 'mcp__github__create_pr'),
                  attr('success', 'true'),
                  attr('tool_input', JSON.stringify({ title: sentinel }))
                ]
              }
            ]
          }
        ]
      }
    ]
  });

  let desktopScope = (desktop: { toolDetails: boolean; sessionContext: boolean }) =>
    createScope({ organization: { settings: { desktop } } });

  let records = async (instance: { id: string }) =>
    (await instanceRecords(instance)).map(entry => entry.record);

  let toolInputs = (stored: Awaited<ReturnType<typeof records>>) =>
    stored
      .filter(record => record.type == 'tool.call')
      .flatMap(record => record.content.filter(entry => entry.role == 'tool_input'));

  it('stores no tool details from a device token while detailed tool reporting is off', async () => {
    let scope = await desktopScope({ toolDetails: false, sessionContext: true });
    let { instance, secret } = await createToken({}, scope);

    expect((await send('/v1/logs', secret, toolLogs())).status).toBe(200);

    let stored = await records(instance);
    let commit = stored.find(record => record.type == 'vcs.commit');

    expect(toolInputs(stored)).toEqual([]);
    expect(JSON.stringify(stored)).not.toMatch(/SENTINEL|github__|create_pr/);
    expect(stored.map(record => record.data.tool).filter(Boolean)).toContainEqual({
      name: 'mcp_tool',
      kind: 'mcp',
      class: 'mcp'
    });
    expect(commit!.data).toEqual({ sha, branch: 'feature/MT-7-notes', source: 'otel' });
    expect(commit!.source.fact_key).toBe(`commit:${commit!.ctx.session_key}:${sha}`);
  });

  it('keeps tool details while detailed tool reporting is on', async () => {
    let scope = await desktopScope({ toolDetails: true, sessionContext: true });
    let { instance, secret } = await createToken({}, scope);

    await send('/v1/logs', secret, toolLogs());

    expect(toolInputs(await records(instance)).length).toBeGreaterThanOrEqual(2);
  });

  it('keeps tool details for tokens that are not bound to a device', async () => {
    let scope = await desktopScope({ toolDetails: false, sessionContext: true });
    let { instance, secret } = await createToken({ deviceMode: 'ephemeral' }, scope);

    await send('/v1/logs', secret, toolLogs());

    expect(toolInputs(await records(instance)).length).toBeGreaterThanOrEqual(2);
  });

  it('stores no session context or commits while session context is off', async () => {
    let scope = await desktopScope({ toolDetails: true, sessionContext: false });
    let { instance, secret } = await createToken({}, scope);

    await send('/v1/logs', secret, toolLogs());

    let stored = await records(instance);

    expect(stored.map(record => record.type).sort()).toEqual(['tool.call', 'tool.call']);
    expect(JSON.stringify(stored)).not.toContain(sha);
  });
});
