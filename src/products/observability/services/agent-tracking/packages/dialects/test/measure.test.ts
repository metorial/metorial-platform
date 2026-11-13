import { describe, expect, it } from 'vitest';
import { buildDraft } from './build';
import { groupOf, metricPoint, nanosOf } from '@mtsrc/agent-tracking-otlp/test/otlp';
import { allowedDims, cleanDims, droppedAttributes, measurementDraft } from '../src/measure';
import { buildGroupContext } from '../src/otlp/common';

let context = buildGroupContext(
  'metrics',
  { attributes: { 'service.name': 'svc', 'user.email': 'dev@example.com' } },
  { name: 'scope', version: '1', attributes: {} }
);

let client = { family: 'claude-code' };

let draftFor = (
  point: ReturnType<typeof metricPoint>,
  spec: Partial<Parameters<typeof measurementDraft>[2]> = {}
) => measurementDraft(context, point, { type: 'tokens', unit: '{token}', client, ...spec });

describe('cleanDims', () => {
  it('keeps allowed dims and reports the others without echoing values', () => {
    let result = cleanDims({ model: 'm', secret_thing: 'value', outcome: 'ok' });

    expect(result.dims).toEqual({ model: 'm', outcome: 'ok' });
    expect(result.dropped).toEqual(['dim:secret_thing']);
  });

  it('skips undefined and empty values without reporting them', () => {
    expect(cleanDims({ model: undefined, provider: '' })).toEqual({ dims: {}, dropped: [] });
  });

  it('clamps long values', () => {
    expect(cleanDims({ model: 'x'.repeat(200) }).dims['model']).toHaveLength(64);
  });

  it('exposes the allowed dimension set', () => {
    expect(allowedDims.has('model')).toBe(true);
    expect(allowedDims.has('session_id')).toBe(false);
    expect(allowedDims.has('user_email')).toBe(false);
  });
});

describe('droppedAttributes', () => {
  it('lists unused attributes but ignores identity attributes', () => {
    let names = droppedAttributes(
      { model: 'm', 'session.id': 's', 'user.email': 'e', extra: 1, 'terminal.type': 'x' },
      ['model']
    );

    expect(names).toEqual(['attr:extra']);
  });

  it('caps at eight and sanitizes names', () => {
    let attributes: Record<string, number> = {};
    for (let i = 0; i < 20; i++) attributes[`k${i}`] = i;
    attributes['bad name with spaces'] = 1;

    let names = droppedAttributes(attributes, []);

    expect(names).toHaveLength(8);
    expect(droppedAttributes({ 'bad name with spaces': 1 }, [])).toEqual(['attr:unknown']);
  });
});

describe('measurementDraft', () => {
  it('builds a delta measurement from a sum point', () => {
    let draft = draftFor(
      metricPoint('claude_code.token.usage', 120, {
        model: 'm',
        type: 'input',
        'session.id': 'sess-1'
      }),
      { dims: { model: 'm', token_type: 'input' }, usedAttributes: ['model', 'type'] }
    )!;

    expect(draft).toMatchObject({
      kind: 'measurement',
      type: 'tokens',
      signalName: 'claude_code.token.usage',
      occurredAt: new Date(Number(nanosOf('2026-06-15T11:59:30.000Z') / 1_000_000n)),
      ctx: { sessionId: 'sess-1' },
      data: {
        name: 'tokens',
        value: 120,
        unit: '{token}',
        aggregation: 'delta',
        window: { start: '2026-06-15T11:59:00.000Z', end: '2026-06-15T11:59:30.000Z' },
        dims: { model: 'm', token_type: 'input' }
      },
      dropped: []
    });
    expect(draft.data).not.toHaveProperty('histogram');
    expect(draft.data).not.toHaveProperty('temporality');
  });

  it('uses cumulative for cumulative sums and gauge for gauges', () => {
    expect(
      draftFor(metricPoint('m', 1, {}, { temporality: 'cumulative' }))?.data?.['aggregation']
    ).toBe('cumulative');
    expect(
      draftFor(metricPoint('m', 1, {}, { shape: 'gauge', temporality: 'unspecified' }))
        ?.data?.['aggregation']
    ).toBe('gauge');
    expect(
      draftFor(metricPoint('m', 1, {}, { temporality: 'unspecified' }))?.data?.['aggregation']
    ).toBe('delta');
  });

  it('builds histogram data with scaling', () => {
    let draft = draftFor(
      metricPoint(
        'm',
        null,
        {},
        {
          shape: 'histogram',
          temporality: 'cumulative',
          histogram: { count: 4, sum: 2, min: 0.25, max: 1 }
        }
      ),
      { scale: 1000 }
    )!;

    expect(draft.data).toMatchObject({
      value: 2000,
      aggregation: 'histogram',
      temporality: 'cumulative',
      histogram: { count: 4, sum: 2000, min: 250, max: 1000 }
    });
  });

  it('omits missing histogram bounds', () => {
    let draft = draftFor(
      metricPoint('m', null, {}, { shape: 'histogram', histogram: { count: 1, sum: 3 } })
    )!;

    expect(draft.data?.['histogram']).toEqual({ count: 1, sum: 3 });
  });

  it('applies the scale to plain values', () => {
    expect(draftFor(metricPoint('m', 1.5), { scale: 1000 })?.data?.['value']).toBe(1500);
  });

  it.each([null, NaN, Infinity, -Infinity])('returns null for the value %s', value => {
    expect(draftFor(metricPoint('m', value))).toBeNull();
  });

  it('keeps zero and negative values', () => {
    expect(draftFor(metricPoint('m', 0))?.data?.['value']).toBe(0);
    expect(draftFor(metricPoint('m', -2))?.data?.['value']).toBe(-2);
  });

  it('has a null window when the timestamps are unset', () => {
    let draft = draftFor(metricPoint('m', 1, {}, { startNs: 0n, timeNs: 0n }))!;

    expect(draft.occurredAt).toBeNull();
    expect(draft.data?.['window']).toEqual({ start: null, end: null });
  });

  it('reports unknown dims and unused attributes by name only', () => {
    let draft = draftFor(
      metricPoint('m', 1, { used: 'x', leaked: 'SENTINEL-VALUE', 'session.id': 's' }),
      { dims: { model: 'm', nonsense: 'SENTINEL-VALUE' }, usedAttributes: ['used'] }
    )!;

    expect(draft.dropped).toEqual(['dim:nonsense', 'attr:leaked']);
    expect(JSON.stringify({ ...draft, identity: '' })).not.toContain('SENTINEL-VALUE');
  });

  it('derives the actor from attributes then resource', () => {
    let draft = draftFor(metricPoint('m', 1, { 'user.id': 'u-1' }))!;

    expect(draft.actor).toMatchObject({
      user: { id: 'u-1', email: 'dev@example.com' },
      identity_source: 'client_claim'
    });

    expect(draftFor(metricPoint('m', 1))?.actor).toMatchObject({
      user: { email: 'dev@example.com' },
      identity_source: 'resource_attribute'
    });
  });

  it('is deterministic and unique per point identity', () => {
    let a = draftFor(metricPoint('m', 1, { a: 'x' }))!;
    let b = draftFor(metricPoint('m', 1, { a: 'x' }))!;
    let c = draftFor(metricPoint('m', 1, { a: 'y' }))!;
    let d = draftFor(
      metricPoint('m', 1, { a: 'x' }, { timeNs: nanosOf('2026-06-15T11:59:31.000Z') })
    )!;

    expect(a.identity).toBe(b.identity);
    expect(a.identity).not.toBe(c.identity);
    expect(a.identity).not.toBe(d.identity);
  });

  it('sanitizes odd metric names for the signal name only', () => {
    let draft = draftFor(metricPoint('weird name!', 1))!;

    expect(draft.signalName).toBe('unknown');
    expect(draft.identity).toContain('weird name!');
  });

  it('passes through covers, warnings and native version', () => {
    let draft = draftFor(metricPoint('m', 1), {
      covers: ['model.request'],
      warnings: ['w'],
      nativeVersion: '1.2'
    })!;

    expect(draft.data?.['covers']).toEqual(['model.request']);
    expect(draft.warnings).toEqual(['w']);
    expect(draft.nativeVersion).toBe('1.2');
  });

  it('builds a valid record', () => {
    let draft = draftFor(metricPoint('m', 3, { model: 'm' }), {
      dims: { model: 'm' },
      usedAttributes: ['model']
    })!;

    let record = buildDraft(
      draft,
      {},
      { adapter: 'a', dialect: 'd', channel: 'otlp.metrics' }
    );

    expect(record.kind).toBe('measurement');
    expect(record.source.channel).toBe('otlp.metrics');
  });
});

void groupOf;
