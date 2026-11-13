import { describe, expect, it } from 'vitest';
import { bucketEnd, bucketStart } from '../buckets';
import { formatAmount, parseAmount, toDecimal } from '../decimal';
import { sourceKindOf, sourceLastSeen, usageRank } from '../sources';

describe('sourceKindOf', () => {
  it('maps ingest channels to source kinds', () => {
    expect(sourceKindOf({ channel: 'hook', credentialKind: 'token' })).toBe('hook');
    expect(sourceKindOf({ channel: 'otlp.logs', credentialKind: 'token' })).toBe('otel.logs');
    expect(sourceKindOf({ channel: 'otlp.traces', credentialKind: 'token' })).toBe(
      'otel.spans'
    );
    expect(sourceKindOf({ channel: 'otlp.metrics', credentialKind: 'token' })).toBe(
      'otel.metrics'
    );
    expect(sourceKindOf({ channel: 'transcript', credentialKind: 'token' })).toBe(
      'transcript'
    );
    expect(sourceKindOf({ channel: 'envelope', credentialKind: 'token' })).toBe('plugin');
  });

  it('treats source credentials as vendor data', () => {
    expect(sourceKindOf({ channel: 'hook', credentialKind: 'source' })).toBe('vendor');
  });

  it('reads the producer of session.context records', () => {
    expect(
      sourceKindOf({
        channel: 'hook',
        credentialKind: 'token',
        type: 'session.context',
        data: { source: 'probe' }
      })
    ).toBe('probe');

    expect(
      sourceKindOf({
        channel: 'hook',
        credentialKind: 'token',
        type: 'session.context',
        data: { source: 'credential' }
      })
    ).toBe('hook');
  });
});

describe('sourceLastSeen', () => {
  it('reads nested otel kinds as Mongo stores them', () => {
    let at = new Date('2026-03-04T10:00:00Z');

    expect(sourceLastSeen({ otel: { logs: at } }, 'otel.logs')).toBe(at);
    expect(sourceLastSeen({ hook: at }, 'hook')).toBe(at);
    expect(sourceLastSeen({ hook: at }, 'otel.spans')).toBeUndefined();
    expect(sourceLastSeen(undefined, 'hook')).toBeUndefined();
  });
});

describe('usageRank', () => {
  it('follows the per-family usage precedence', () => {
    expect(usageRank('claude-code', 'otel.logs')).toBeLessThan(
      usageRank('claude-code', 'hook')
    );
    expect(usageRank('cursor', 'vendor')).toBeLessThan(usageRank('cursor', 'hook'));
    expect(usageRank('cursor', 'hook')).toBeLessThan(usageRank('cursor', 'otel.logs'));
    expect(usageRank('copilot-cli', 'otel.spans')).toBeLessThan(
      usageRank('copilot-cli', 'otel.logs')
    );
    expect(usageRank('opencode', 'plugin')).toBeLessThan(usageRank('opencode', 'otel.spans'));
  });

  it('ranks unknown families by the default order and unknown kinds last', () => {
    expect(usageRank('generic', 'vendor')).toBe(0);
    expect(usageRank('claude-code', undefined)).toBeGreaterThan(
      usageRank('claude-code', 'vendor')
    );
    expect(usageRank('claude-code', 'otel.metrics')).toBe(usageRank('claude-code', undefined));
  });
});

describe('buckets', () => {
  it('floors to 15-minute and daily UTC buckets', () => {
    let at = new Date('2026-03-04T10:44:59.999Z');

    expect(bucketStart(at, 15).toISOString()).toBe('2026-03-04T10:30:00.000Z');
    expect(bucketStart(at, 1440).toISOString()).toBe('2026-03-04T00:00:00.000Z');
    expect(bucketEnd(bucketStart(at, 15), 15).toISOString()).toBe('2026-03-04T10:45:00.000Z');
    expect(bucketStart(new Date('2026-03-04T10:45:00.000Z'), 15).toISOString()).toBe(
      '2026-03-04T10:45:00.000Z'
    );
  });
});

describe('decimal amounts', () => {
  it('parses strings, numbers and Decimal128 exactly', () => {
    expect(formatAmount(parseAmount('0.000123')!)).toBe('0.000123');
    expect(formatAmount(parseAmount(0.1 + 0.2)!)).toBe('0.3');
    expect(formatAmount(parseAmount(toDecimal(parseAmount('-12.5')!))!)).toBe('-12.5');
    expect(parseAmount('abc')).toBeUndefined();
  });

  it('sums without float drift', () => {
    let total = parseAmount('0.1')! + parseAmount('0.2')!;

    expect(toDecimal(total).toString()).toBe('0.3');
  });

  it('gives up fraction digits beyond Decimal128 precision', () => {
    let large = parseAmount('12345678901234567890.123456789012345678')!;

    expect(toDecimal(large).toString()).toBe('12345678901234567890.12345678901234');
  });
});
