import type { Group, LogDesc, MetricDesc, SpanDesc } from '../../test/protobuf';

export let traceHex = '0123456789abcdef0123456789abcdef';
export let spanHex = '0123456789abcdef';
export let parentHex = 'fedcba9876543210';

let resource = {
  attributes: {
    'service.name': 'claude-code',
    'service.version': '2.1.0',
    'host.arch': 'arm64',
    'process.pid': 4242,
    'telemetry.sdk.language': 'nodejs'
  }
};

let scope = {
  name: 'com.anthropic.claude_code.events',
  version: '2.1.0',
  attributes: { 'scope.flag': true }
};

export let logGroups: Group<LogDesc>[] = [
  {
    resource,
    scope,
    items: [
      {
        timeNs: 1_781_524_800_123_456_789n,
        observedTimeNs: 1_781_524_800_200_000_000n,
        severityNumber: 9,
        severityText: 'INFO',
        eventName: 'claude_code.user_prompt',
        body: 'claude_code.user_prompt',
        attributes: {
          'event.name': 'user_prompt',
          'session.id': 'sess-1',
          'prompt.id': 'p-1',
          prompt_length: 42,
          'is.test': false,
          ratio: 0.25,
          big: 9_007_199_254_740_993n,
          negative: -7,
          tags: ['a', 'b', 3],
          nested: { inner: 'x', deep: { n: 1 } },
          raw: new Uint8Array([1, 2, 3, 255]),
          unicode: 'héllo 😀 世界'
        },
        traceId: traceHex,
        spanId: spanHex
      },
      {
        timeNs: 1_781_524_801_000_000_000n,
        body: { structured: 'body', n: 2 },
        attributes: { 'event.name': 'tool_result' }
      }
    ]
  },
  {
    resource: { attributes: { 'service.name': 'codex_cli_rs' } },
    scope: { name: 'codex', version: '0.5.0' },
    items: [{ timeNs: 1_781_524_802_000_000_000n, body: 'codex.api_request', attributes: {} }]
  }
];

export let metricGroups: Group<MetricDesc>[] = [
  {
    resource,
    scope: { name: 'com.anthropic.claude_code', version: '2.1.0' },
    items: [
      {
        name: 'claude_code.token.usage',
        unit: 'tokens',
        shape: 'sum',
        temporality: 'delta',
        monotonic: true,
        points: [
          {
            attributes: { type: 'input', model: 'claude-sonnet-4-5' },
            startNs: 1_781_524_740_000_000_000n,
            timeNs: 1_781_524_800_000_000_000n,
            asInt: 1200
          },
          {
            attributes: { type: 'output', model: 'claude-sonnet-4-5' },
            startNs: 1_781_524_740_000_000_000n,
            timeNs: 1_781_524_800_000_000_000n,
            asDouble: 340.5
          }
        ]
      },
      {
        name: 'claude_code.active_time.total',
        unit: 's',
        shape: 'gauge',
        points: [{ timeNs: 1_781_524_800_000_000_000n, asDouble: 12.5 }]
      },
      {
        name: 'gen_ai.client.operation.duration',
        unit: 's',
        shape: 'histogram',
        temporality: 'cumulative',
        points: [
          {
            attributes: { 'gen_ai.operation.name': 'chat' },
            timeNs: 1_781_524_800_000_000_000n,
            count: 4,
            sum: 6.5,
            min: 0.5,
            max: 3
          }
        ]
      },
      {
        name: 'exp.hist',
        shape: 'exponential_histogram',
        temporality: 'delta',
        points: [{ timeNs: 1_781_524_800_000_000_000n, count: 2, sum: 9, min: 4, max: 5 }]
      },
      {
        name: 'summary.metric',
        shape: 'summary',
        points: [{ timeNs: 1_781_524_800_000_000_000n, count: 3, sum: 12 }]
      }
    ]
  }
];

export let traceGroups: Group<SpanDesc>[] = [
  {
    resource,
    scope: { name: 'tracer', version: '1' },
    items: [
      {
        traceId: traceHex,
        spanId: spanHex,
        parentSpanId: parentHex,
        name: 'chat claude-sonnet-4-5',
        kind: 3,
        startNs: 1_781_524_800_000_000_000n,
        endNs: 1_781_524_802_500_000_000n,
        attributes: { 'gen_ai.operation.name': 'chat', 'gen_ai.usage.input_tokens': 120 },
        events: [
          {
            timeNs: 1_781_524_801_000_000_000n,
            name: 'gen_ai.content.prompt',
            attributes: { 'gen_ai.prompt': 'hi' }
          }
        ],
        status: { code: 2, message: 'boom' }
      },
      { name: 'bare' }
    ]
  }
];
