import { describe, expect, it } from 'vitest';
import { FieldReader } from '../fields';
import {
  actorOf,
  attributeFingerprint,
  buildGroupContext,
  clampLabel,
  clientVersionOf,
  groupContext,
  otlpChannel,
  otlpSource,
  safeNativeName,
  stripPrefix,
  surfaceFromLabel,
  terminalOf,
  traceOf
} from '../otlp/common';
import { groupOf, logRecord, metricPoint, spanOf } from '../../test/otlp';

let reader = (source: Record<string, unknown>) => new FieldReader(source, 'x.');

describe('attributeFingerprint', () => {
  it('is independent of key order', () => {
    expect(attributeFingerprint({ b: 1, a: 'x' })).toBe(
      attributeFingerprint({ a: 'x', b: 1 })
    );
  });

  it('distinguishes values, keys and types of structure', () => {
    let seen = new Set([
      attributeFingerprint({ a: 1 }),
      attributeFingerprint({ a: 2 }),
      attributeFingerprint({ b: 1 }),
      attributeFingerprint({ a: '1', c: 0 }),
      attributeFingerprint({ a: [1] }),
      attributeFingerprint({ a: { x: 1 } }),
      attributeFingerprint({ a: true }),
      attributeFingerprint({})
    ]);

    expect(seen.size).toBe(8);
  });

  it('truncates very long values but still reflects their length', () => {
    let short = attributeFingerprint({ a: 'x'.repeat(600) });
    let long = attributeFingerprint({ a: 'x'.repeat(601) });

    expect(short.length).toBeLessThan(600);
    expect(short).not.toBe(long);
  });

  it('cannot be confused by delimiter characters inside values', () => {
    expect(attributeFingerprint({ a: 'x\u0001b=y' })).not.toBe(
      attributeFingerprint({ a: 'x', b: 'y' })
    );
  });
});

describe('groupContext', () => {
  let resource = { 'service.name': 'svc', 'service.version': '1.2.3' };

  it('reads the service name and fingerprints the resource', () => {
    let context = buildGroupContext('logs', { attributes: resource }, groupOf([]).scope, 'x');

    expect(context.serviceName).toBe('svc');
    expect(context.sampleName).toBe('x');
    expect(context.resourceFingerprint).toBe(attributeFingerprint(resource));
  });

  it('uses a string log body as the sample name, clipped to 128', () => {
    let context = groupContext(
      'logs',
      groupOf([logRecord({}, { body: 'b'.repeat(500) })], resource)
    );

    expect(context.sampleName).toBe('b'.repeat(128));
  });

  it('falls back to the event name for non-string bodies', () => {
    let context = groupContext(
      'logs',
      groupOf([logRecord({}, { body: { a: 1 }, eventName: 'ev' })], resource)
    );

    expect(context.sampleName).toBe('ev');
    expect(
      groupContext('logs', groupOf([logRecord({}, { body: null, eventName: '' })])).sampleName
    ).toBeUndefined();
  });

  it('uses the name of the first metric point or span', () => {
    expect(
      groupContext('metrics', groupOf([metricPoint('m.one', 1), metricPoint('m.two', 1)]))
        .sampleName
    ).toBe('m.one');
    expect(groupContext('traces', groupOf([spanOf('s'.repeat(300))])).sampleName).toBe(
      's'.repeat(128)
    );
  });

  it('has no sample for an empty group', () => {
    expect(groupContext('logs', groupOf([])).sampleName).toBeUndefined();
  });
});

describe('otlpChannel and otlpSource', () => {
  it('maps signals to channels', () => {
    expect(otlpChannel('logs')).toBe('otlp.logs');
    expect(otlpChannel('metrics')).toBe('otlp.metrics');
    expect(otlpChannel('traces')).toBe('otlp.traces');
    expect(otlpSource('a', 'd', 'traces')).toEqual({
      adapter: 'a',
      dialect: 'd',
      channel: 'otlp.traces'
    });
  });
});

describe('surfaceFromLabel', () => {
  it.each([
    ['cli', 'cli'],
    ['IDE', 'ide'],
    ['vscode', 'ide'],
    ['jetbrains-plugin', 'ide'],
    ['claude-vscode', 'ide'],
    ['agent-sdk', 'sdk'],
    ['sdk-ts', 'sdk'],
    ['claude-desktop', 'desktop'],
    ['cowork', 'desktop'],
    ['codex-app-server', 'app_server'],
    ['codex_app_server', 'app_server'],
    ['codex_exec', 'cli'],
    ['codex_tui', 'cli'],
    ['mystery', undefined],
    ['', undefined],
    [undefined, undefined]
  ])('maps %j to %j', (label, expected) => {
    expect(surfaceFromLabel(label)).toBe(expected);
  });
});

describe('small helpers', () => {
  it('reads the client version from attributes before the resource', () => {
    expect(
      clientVersionOf(reader({ 'app.version': 'r' }), reader({ 'app.version': 'a' }))
    ).toBe('a');
    expect(clientVersionOf(reader({ 'service.version': 'sv' }))).toBe('sv');
    expect(clientVersionOf(reader({ 'app.version': 'av' }))).toBe('av');
    expect(clientVersionOf(reader({}))).toBeUndefined();
  });

  it('accepts a short terminal type only', () => {
    expect(terminalOf(reader({ 'terminal.type': 'iTerm.app' }))).toBe('iTerm.app');
    expect(terminalOf(reader({ 'terminal.type': 't'.repeat(65) }))).toBeUndefined();
    expect(terminalOf(reader({}))).toBeUndefined();
  });

  it('builds trace info only when ids are present', () => {
    expect(traceOf({ traceId: '', spanId: '' })).toBeUndefined();
    expect(traceOf({ traceId: 't', spanId: '' })).toEqual({ traceId: 't' });
    expect(traceOf({ traceId: 't', spanId: 's', parentSpanId: 'p' })).toEqual({
      traceId: 't',
      spanId: 's',
      parentSpanId: 'p'
    });
    expect(traceOf({ traceId: '', spanId: 's', parentSpanId: '' })).toEqual({ spanId: 's' });
  });

  it('strips prefixes only at the start', () => {
    expect(stripPrefix('claude_code.x', 'claude_code.')).toBe('x');
    expect(stripPrefix('x.claude_code.', 'claude_code.')).toBe('x.claude_code.');
    expect(stripPrefix('claude_code.', 'claude_code.')).toBe('');
  });

  it('clamps labels', () => {
    expect(clampLabel(undefined)).toBeUndefined();
    expect(clampLabel('  ')).toBeUndefined();
    expect(clampLabel('a\u0000b\n')).toBe('ab');
    expect(clampLabel('x'.repeat(300))).toHaveLength(128);
    expect(clampLabel('x'.repeat(300), 10)).toHaveLength(10);
  });

  it('only allows plain native names', () => {
    expect(safeNativeName('claude_code.user_prompt')).toBe('claude_code.user_prompt');
    expect(safeNativeName('a:b-c')).toBe('a:b-c');
    expect(safeNativeName('has space')).toBe('unknown');
    expect(safeNativeName('x'.repeat(65))).toBe('unknown');
    expect(safeNativeName('/path/to/secret')).toBe('unknown');
    expect(safeNativeName('')).toBe('unknown');
    expect(safeNativeName(undefined)).toBe('unknown');
    expect(safeNativeName('new\nline')).toBe('unknown');
  });
});

describe('actorOf', () => {
  it('returns nothing without identity attributes', () => {
    expect(actorOf(reader({}), reader({}))).toBeUndefined();
  });

  it('prefers attribute identity and marks it as a client claim', () => {
    expect(
      actorOf(
        reader({ 'user.id': 'u', 'user.email': 'e@x', 'organization.id': 'o' }),
        reader({ 'user.id': 'ru' })
      )
    ).toEqual({
      user: { id: 'u', email: 'e@x' },
      org_claim: 'o',
      identity_source: 'client_claim'
    });
  });

  it('falls back to resource attributes', () => {
    expect(actorOf(reader({}), reader({ 'user.account_id': 'acct' }))).toEqual({
      user: { id: 'acct' },
      identity_source: 'resource_attribute'
    });
  });

  it('merges per field, calling it a claim when any came from the event', () => {
    expect(actorOf(reader({ 'user.email': 'e@x' }), reader({ 'user.id': 'ru' }))).toEqual({
      user: { id: 'ru', email: 'e@x' },
      identity_source: 'client_claim'
    });
  });

  it('supports an org-only actor', () => {
    expect(actorOf(reader({ 'organization.id': 'o' }), reader({}))).toEqual({
      org_claim: 'o',
      identity_source: 'client_claim'
    });
  });
});
