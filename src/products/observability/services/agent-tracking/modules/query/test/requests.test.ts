import { describe, expect, it } from 'vitest';
import { datasets } from '../src/catalog';
import { readPath } from '../src/lib/rows';
import { bind } from './compileHarness';

let stored = {
  data: {
    effort: 'max',
    speed: 'fast',
    stopReason: 'end_turn',
    durationMs: 4000,
    ttftMs: 800,
    billing: { mode: 'included', plan: 'max', seat: 'premium' }
  }
};

let errorCodes = (query: Record<string, unknown>) => {
  try {
    bind(query, { hideIndividuals: true, minGroupUsers: 2 });
    return [];
  } catch (error) {
    return (error as { errors: { code: string }[] }).errors.map(item => item.code);
  }
};

describe('request fields', () => {
  it('read the values the dialects store', () => {
    let expected: Record<string, unknown> = {
      'reasoning.effort': 'max',
      speed: 'fast',
      finish_reason: 'end_turn',
      latency: 4000,
      ttft: 800,
      'billing.plan': 'max',
      'billing.seat': 'premium'
    };

    for (let [name, value] of Object.entries(expected)) {
      let source = datasets.requests.fields[name]!.source;

      expect(source.kind, name).toBe('stored');
      expect(readPath(stored, (source as { path: string }).path), name).toBe(value);
    }
  });

  it('offer the seat as a dimension and a filter, and leave the billing mode out', () => {
    let fields = datasets.requests.fields;

    expect(fields['billing.seat']).toMatchObject({
      dimension: true,
      filter: true,
      measure: false,
      sensitivity: 'normal'
    });
    expect(Object.keys(fields)).toEqual(
      expect.arrayContaining(['billing.plan', 'billing.seat', 'reasoning.effort', 'speed'])
    );
    expect(Object.keys(fields)).not.toContain('billing.mode');
  });

  it('group by seat but not by seat and user when individuals are hidden', () => {
    let query = { dataset: 'requests', measures: ['requests'] };

    expect(errorCodes({ ...query, dimensions: ['user', 'billing.seat'] })).toContain(
      'personal_field'
    );
    expect(errorCodes({ ...query, dimensions: ['billing.seat'] })).toEqual([]);
  });
});
