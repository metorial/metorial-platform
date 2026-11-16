import { describe, expect, it } from 'vitest';
import { groupOf, logRecord, metricPoint, spanOf } from '@mtsrc/agent-tracking-otlp/test/otlp';
import type { OtlpAttributes, OtlpDecoded } from '@mtsrc/agent-tracking-otlp';
import { claudeCodeOtlp } from '../src/otlp/claudeCode';
import { codexOtlp } from '../src/otlp/codex';
import { genAiOtlp } from '../src/otlp/genai';
import { quarantineOtlp } from '../src/otlp/quarantine';
import {
  dialectManifests,
  isVersionSupported,
  mapOtlpDecoded,
  mapOtlpGroup,
  otlpDialects,
  resolveBulkDialect,
  selectOtlpDialect
} from '../src/registry';

let logsGroup = (resource: OtlpAttributes, body = 'x', scope = '') =>
  groupOf([logRecord({}, { body })], resource, { name: scope });

describe('selectOtlpDialect', () => {
  it('lists the dialects in priority order', () => {
    expect(otlpDialects).toEqual([claudeCodeOtlp, codexOtlp, genAiOtlp]);
  });

  it.each([
    ['claude-code', claudeCodeOtlp],
    ['codex_cli_rs', codexOtlp]
  ])('selects by the service name %s', (service, dialect) => {
    expect(selectOtlpDialect('logs', logsGroup({ 'service.name': service })).dialect).toBe(
      dialect
    );
  });

  it('selects by scope name and by sample name', () => {
    expect(
      selectOtlpDialect('logs', logsGroup({}, 'x', 'com.anthropic.claude_code')).dialect
    ).toBe(claudeCodeOtlp);
    expect(selectOtlpDialect('logs', logsGroup({}, 'x', 'codex_otel.x')).dialect).toBe(
      codexOtlp
    );
    expect(selectOtlpDialect('logs', logsGroup({}, 'claude_code.api_request')).dialect).toBe(
      claudeCodeOtlp
    );
    expect(selectOtlpDialect('logs', logsGroup({}, 'gen_ai.client.inference')).dialect).toBe(
      genAiOtlp
    );
  });

  it('selects the GenAI dialect for matching span names', () => {
    let group = groupOf([spanOf('chat gpt-4o')], { 'service.name': 'my-agent' });

    expect(selectOtlpDialect('traces', group).dialect).toBe(genAiOtlp);
  });

  it('prefers the first matching dialect', () => {
    let group = groupOf([spanOf('chat x')], { 'service.name': 'claude-code' });

    expect(selectOtlpDialect('traces', group).dialect).toBe(claudeCodeOtlp);
  });

  it('falls back to quarantine for unknown sources and empty groups', () => {
    expect(selectOtlpDialect('logs', logsGroup({ 'service.name': 'mystery' })).dialect).toBe(
      quarantineOtlp
    );
    expect(selectOtlpDialect('traces', groupOf([], {})).dialect).toBe(quarantineOtlp);
  });

  it('returns a context carrying the signal and service name', () => {
    let { context } = selectOtlpDialect('metrics', groupOf([], { 'service.name': 'abc' }));

    expect(context).toMatchObject({ signal: 'metrics', serviceName: 'abc' });
  });
});

describe('mapOtlpGroup', () => {
  let claude = { 'service.name': 'claude-code' };

  it('maps every item that yields records', () => {
    let group = groupOf(
      [logRecord({ 'event.name': 'user_prompt' }), logRecord({ 'event.name': 'api_request' })],
      claude
    );

    let result = mapOtlpGroup('logs', group);

    expect(result).toMatchObject({ dialect: claudeCodeOtlp, suppressed: 0, failed: 0 });
    expect(result.mapped.map(m => m.draft.type)).toEqual([
      'prompt.submitted',
      'model.request'
    ]);
  });

  it('counts empty results as suppressed', () => {
    let group = groupOf(
      [
        metricPoint('session.count', 1),
        metricPoint('unknown.metric', 1),
        metricPoint('x', null)
      ],
      claude
    );

    let result = mapOtlpGroup('metrics', group);

    expect(result.mapped).toHaveLength(1);
    expect(result.suppressed).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('counts mapper exceptions as failed and keeps going', () => {
    let throwing = {
      ...logRecord({ 'event.name': 'user_prompt' }),
      get attributes(): OtlpAttributes {
        throw new Error('boom');
      }
    };

    let group = groupOf([throwing, logRecord({ 'event.name': 'user_prompt' })], claude);

    let result = mapOtlpGroup('logs', group);

    expect(result.failed).toBe(1);
    expect(result.mapped).toHaveLength(1);
  });

  it('counts every item as suppressed when the dialect has no mapper for the signal', () => {
    let original = codexOtlp.mapSpan;
    codexOtlp.mapSpan = undefined;

    try {
      let group = groupOf([spanOf('a'), spanOf('b')], { 'service.name': 'codex_cli_rs' });

      expect(mapOtlpGroup('traces', group)).toMatchObject({
        dialect: codexOtlp,
        mapped: [],
        suppressed: 2,
        failed: 0
      });
    } finally {
      codexOtlp.mapSpan = original;
    }
  });

  it('routes unknown groups through quarantine for every signal', () => {
    let resource = { 'service.name': 'mystery' };

    let logs = mapOtlpGroup('logs', groupOf([logRecord({}, { body: 'e' })], resource));
    let metrics = mapOtlpGroup('metrics', groupOf([metricPoint('m', 1)], resource));
    let traces = mapOtlpGroup('traces', groupOf([spanOf('s')], resource));

    for (let result of [logs, metrics, traces]) {
      expect(result.dialect).toBe(quarantineOtlp);
      expect(result.mapped).toHaveLength(1);
      expect(result.mapped[0]?.draft.type).toBe('unmapped');
    }
  });

  it('handles empty groups', () => {
    expect(mapOtlpGroup('logs', groupOf([], {}))).toMatchObject({
      mapped: [],
      suppressed: 0,
      failed: 0
    });
  });
});

describe('mapOtlpDecoded', () => {
  let decoded = <T>(groups: ReturnType<typeof groupOf<T>>[]): OtlpDecoded<T> =>
    ({ groups, rejected: 0 }) as unknown as OtlpDecoded<T>;

  it('sums counts across groups', () => {
    let result = mapOtlpDecoded(
      'metrics',
      decoded([
        groupOf([metricPoint('session.count', 1), metricPoint('nope', 1)], {
          'service.name': 'claude-code'
        }),
        groupOf(
          [
            metricPoint('thread.started', 1),
            metricPoint('turn.token_usage', 1, { token_type: 'total' })
          ],
          {
            'service.name': 'codex_cli_rs'
          }
        ),
        groupOf([metricPoint('anything', 1)], { 'service.name': 'mystery' })
      ])
    );

    expect(result.groups.map(g => g.dialect)).toEqual([
      claudeCodeOtlp,
      codexOtlp,
      quarantineOtlp
    ]);
    expect(result.mapped).toBe(3);
    expect(result.suppressed).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('is empty for no groups', () => {
    expect(mapOtlpDecoded('logs', decoded([]))).toEqual({
      groups: [],
      mapped: 0,
      suppressed: 0,
      failed: 0
    });
  });
});

describe('dialectManifests', () => {
  it('declares the claude-code and codex hook dialects', () => {
    expect(dialectManifests).toEqual([
      { client: 'claude-code', channel: 'hook', dialect: 'claude-code.hooks.v1' },
      { client: 'codex', channel: 'hook', dialect: 'codex.hooks.v1' }
    ]);
  });
});

describe('resolveBulkDialect', () => {
  it('resolves known client, channel and dialect triples', () => {
    for (let manifest of dialectManifests) {
      let result = resolveBulkDialect(manifest.client, manifest.channel, manifest.dialect);

      expect(result).toMatchObject({ ok: true, manifest });
      expect(result.ok && result.dialect.id).toBe(manifest.dialect);
    }
  });

  it('reports an unknown client', () => {
    expect(resolveBulkDialect('cursor', 'hook', 'claude-code.hooks.v1')).toEqual({
      ok: false,
      code: 'unknown_client'
    });
  });

  it('reports an unknown dialect for a known client', () => {
    expect(resolveBulkDialect('codex', 'hook', 'codex.hooks.v9')).toEqual({
      ok: false,
      code: 'unknown_dialect'
    });
    expect(resolveBulkDialect('codex', 'hook', 'claude-code.hooks.v1')).toEqual({
      ok: false,
      code: 'unknown_dialect'
    });
  });

  it('reports an unknown dialect for the wrong channel', () => {
    expect(resolveBulkDialect('codex', 'otlp.logs', 'codex.hooks.v1')).toEqual({
      ok: false,
      code: 'unknown_dialect'
    });
  });

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty', ''])(
    'never resolves the prototype-like client %j',
    client => {
      expect(resolveBulkDialect(client, 'hook', client)).toEqual({
        ok: false,
        code: 'unknown_client'
      });
    }
  );

  it('is case sensitive', () => {
    expect(resolveBulkDialect('Codex', 'hook', 'codex.hooks.v1')).toMatchObject({
      ok: false,
      code: 'unknown_client'
    });
  });
});

describe('isVersionSupported', () => {
  let range = (minVersion?: string, maxVersion?: string) => ({ minVersion, maxVersion });

  it('accepts everything without bounds', () => {
    expect(isVersionSupported(range(), '0.0.1')).toBe(true);
    expect(isVersionSupported(range(), 'garbage')).toBe(true);
    expect(isVersionSupported(range(), undefined)).toBe(true);
  });

  it('accepts a missing version with bounds', () => {
    expect(isVersionSupported(range('1.0.0'), undefined)).toBe(true);
    expect(isVersionSupported(range('1.0.0'), '')).toBe(true);
  });

  it.each([
    ['1.0.0', undefined, '1.0.0', true],
    ['1.0.0', undefined, '0.9.9', false],
    ['1.0.0', undefined, '1.0.1', true],
    ['1.0.0', undefined, '2.0.0', true],
    [undefined, '2.0.0', '2.0.0', true],
    [undefined, '2.0.0', '2.0.1', false],
    [undefined, '2.0.0', '1.99.99', true],
    ['1.2.0', '1.4.0', '1.3.0', true],
    ['1.2.0', '1.4.0', '1.1.9', false],
    ['1.2.0', '1.4.0', '1.4.1', false]
  ])('range %s..%s with %s -> %s', (min, max, version, expected) => {
    expect(isVersionSupported(range(min, max), version)).toBe(expected);
  });

  it('compares numerically, not lexically', () => {
    expect(isVersionSupported(range('1.9.0'), '1.10.0')).toBe(true);
    expect(isVersionSupported(range(undefined, '1.9.0'), '1.10.0')).toBe(false);
  });

  it('treats missing parts as zero', () => {
    expect(isVersionSupported(range('1.0.0'), '1')).toBe(true);
    expect(isVersionSupported(range('1.0.0'), '1.0')).toBe(true);
    expect(isVersionSupported(range('1'), '1.0.0')).toBe(true);
    expect(isVersionSupported(range('1.0.1'), '1.0')).toBe(false);
  });

  it('strips a leading v and pre-release or build suffixes', () => {
    expect(isVersionSupported(range('1.0.0'), 'v1.2.3')).toBe(true);
    expect(isVersionSupported(range('1.0.0'), 'V1.2.3')).toBe(true);
    expect(isVersionSupported(range('1.0.0'), '1.2.3-beta.1')).toBe(true);
    expect(isVersionSupported(range('1.0.0'), '1.2.3+build.5')).toBe(true);
    expect(isVersionSupported(range('1.5.0'), '1.2.3-rc1')).toBe(false);
    expect(isVersionSupported(range('v1.0.0'), '1.0.0')).toBe(true);
  });

  it('trims whitespace', () => {
    expect(isVersionSupported(range('1.0.0'), ' 1.2.3 ')).toBe(true);
  });

  it.each([
    'abc',
    '1.x.0',
    '1..2',
    '.1',
    '1.',
    '-1.0.0',
    '+1',
    'v',
    '1.2.3.beta',
    '1,2,3',
    '１.２',
    '1e3.0',
    '0x10.0',
    '1234567890.0.0',
    ' ',
    '\u0000'
  ])('rejects the unparsable version %j when bounds exist', version => {
    expect(isVersionSupported(range('0.0.1'), version)).toBe(false);
    expect(isVersionSupported(range(undefined, '999.0.0'), version)).toBe(false);
  });

  it('ignores an unparsable bound', () => {
    expect(isVersionSupported(range('garbage'), '1.0.0')).toBe(true);
    expect(isVersionSupported(range('garbage', '2.0.0'), '3.0.0')).toBe(false);
  });

  it('accepts nine digit parts and rejects ten', () => {
    expect(isVersionSupported(range('1.0.0'), '999999999.0.0')).toBe(true);
    expect(isVersionSupported(range('1.0.0'), '1000000000.0.0')).toBe(false);
  });
});
