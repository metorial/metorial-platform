import { describe, expect, it } from 'vitest';
import { buildMapped } from '../../../test/build';
import { groupOf, logRecord, metricPoint, nanosOf, otlpAt, spanOf } from '../../../test/otlp';
import { groupContext } from '../common';
import { quarantineOtlp, quarantineOtlpId } from '../quarantine';

let context = (signal: 'logs' | 'metrics' | 'traces') =>
  groupContext(signal, groupOf([], { 'service.name': 'mystery' }));

describe('quarantineOtlp', () => {
  it('matches everything', () => {
    expect(quarantineOtlp.matches(context('logs'))).toBe(true);
  });

  it('maps a log to an unmapped unknown record with a sanitized name', () => {
    let [mapped] = quarantineOtlp.mapLog!(
      context('logs'),
      logRecord({ secret: 'SENTINEL' }, { body: 'my.event_name' })
    );

    expect(mapped).toMatchObject({
      source: { adapter: 'quarantine', dialect: quarantineOtlpId, channel: 'otlp.logs' },
      draft: {
        kind: 'event',
        type: 'unmapped',
        signalName: 'my.event_name',
        occurredAt: new Date(otlpAt),
        client: { family: 'unknown' },
        data: { native_name: 'my.event_name', category: 'unknown' }
      }
    });
  });

  it('replaces free-text names with unknown and keeps them out of the visible record', () => {
    let body = 'user said SENTINEL please';
    let [mapped] = quarantineOtlp.mapLog!(context('logs'), logRecord({}, { body }));

    expect(mapped?.draft.signalName).toBe('unknown');

    let record = buildMapped(mapped!);

    expect(JSON.stringify(record)).not.toContain('SENTINEL');
  });

  it('falls back to the event name for empty or structured bodies', () => {
    let named = quarantineOtlp.mapLog!(
      context('logs'),
      logRecord({}, { body: '', eventName: 'ev' })
    );
    let structured = quarantineOtlp.mapLog!(
      context('logs'),
      logRecord({}, { body: { a: 1 }, eventName: 'ev2' })
    );

    expect(named[0]?.draft.signalName).toBe('ev');
    expect(structured[0]?.draft.signalName).toBe('ev2');
  });

  it('maps metrics and spans', () => {
    let metric = quarantineOtlp.mapMetric!(context('metrics'), metricPoint('foo.bar', 1))[0]!;
    let span = quarantineOtlp.mapSpan!(context('traces'), spanOf('GET /x'))[0]!;

    expect(metric.source.channel).toBe('otlp.metrics');
    expect(metric.draft).toMatchObject({
      signalName: 'foo.bar',
      occurredAt: new Date(Number(nanosOf(otlpAt) / 1_000_000n))
    });
    expect(span.source.channel).toBe('otlp.traces');
    expect(span.draft.signalName).toBe('unknown');
    expect(span.draft.occurredAt).toEqual(
      new Date(Number(nanosOf('2026-06-15T11:59:28.000Z') / 1_000_000n))
    );
  });

  it('yields distinct identities for distinct items and equal ones for equal items', () => {
    let a = quarantineOtlp.mapLog!(context('logs'), logRecord({ a: 1 }, { body: 'x' }))[0]!;
    let b = quarantineOtlp.mapLog!(context('logs'), logRecord({ a: 1 }, { body: 'x' }))[0]!;
    let c = quarantineOtlp.mapLog!(context('logs'), logRecord({ a: 2 }, { body: 'x' }))[0]!;
    let d = quarantineOtlp.mapLog!(context('logs'), logRecord({ a: 1 }, { body: 'y' }))[0]!;

    expect(a.draft.identity).toBe(b.draft.identity);
    expect(a.draft.identity).not.toBe(c.draft.identity);
    expect(a.draft.identity).not.toBe(d.draft.identity);
  });

  it('records coerced fields without values', () => {
    let [mapped] = quarantineOtlp.mapLog!(
      context('logs'),
      logRecord({ n: 'x' }, { body: 'e' })
    );

    expect(mapped?.draft.coerced).toEqual([]);
  });

  it('handles an unset timestamp', () => {
    let [mapped] = quarantineOtlp.mapLog!(
      context('logs'),
      logRecord({}, { timeNs: 0n, body: 'e' })
    );

    expect(mapped?.draft.occurredAt).toBeNull();
  });
});
