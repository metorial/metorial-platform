import { describe, expect, it } from 'vitest';
import { parseQuery, querySchema, type Query } from '../src';

let base = { atq: '0', dataset: 'usage', range: { last: '7d' } };

let errorsOf = (value: unknown) => {
  let result = parseQuery(value);
  if (result.ok) throw new Error('Expected errors');
  return result.errors;
};

describe('parseQuery', () => {
  it('accepts a full aggregate query', () => {
    let query = {
      ...base,
      timeZone: 'Europe/Berlin',
      where: {
        and: [
          { field: 'client.family', op: 'in', value: ['claude-code', 'codex'] },
          { not: { field: 'speed', op: 'eq', value: 'fast' } },
          {
            or: [
              { field: 'user', op: 'isNull' },
              { field: 'cost.usd', op: 'between', value: [1, 2] }
            ]
          }
        ]
      },
      dimensions: [
        'team',
        { field: 'time.week', as: 'week' },
        { field: 'cost.usd', bins: [0, 1, 10] }
      ],
      measures: [
        'cost.usd',
        {
          fn: 'sum',
          field: 'cost.usd',
          where: { field: 'billing.mode', op: 'eq', value: 'overage' },
          as: 'overage'
        },
        { fn: 'percentile', field: 'latency', q: 0.42 }
      ],
      derived: [{ as: 'share', expr: { div: ['overage', 'cost.usd'] }, format: 'percent' }],
      having: { field: 'cost.usd', op: 'gt', value: 10 },
      orderBy: [{ by: 'cost.usd', direction: 'desc' }],
      limit: 10,
      allocation: 'split',
      compare: { previous: 'period' },
      totals: true,
      other: true,
      fill: { time: 'zero', groups: true },
      labels: false
    };

    let result = parseQuery(query);
    expect(result.ok).toBe(true);
    expect((result as { query: Query }).query).toEqual(query);
  });

  it('accepts the three range forms', () => {
    for (let range of [
      { from: '2026-10-01', to: '2026-11-01T00:00:00Z' },
      { last: '6mo' },
      { preset: 'last_quarter' }
    ]) {
      expect(parseQuery({ ...base, range }).ok).toBe(true);
    }
  });

  it('rejects unknown keys with a pointer and a suggestion', () => {
    let errors = errorsOf({ ...base, dimension: ['team'] });
    expect(errors).toEqual([
      expect.objectContaining({
        code: 'unknown_key',
        pointer: '/dimension',
        message: expect.stringContaining('Did you mean "dimensions"?')
      })
    ]);
  });

  it('points at nested filter errors', () => {
    let errors = errorsOf({
      ...base,
      where: {
        and: [
          { field: 'team', op: 'eq', value: 'x' },
          { field: 'team', op: 'equals', value: 'x' }
        ]
      }
    });

    expect(errors[0]!.pointer).toBe('/where/and/1/op');
    expect(errors[0]!.message).toContain('Did you mean "eq"?');
  });

  it('checks operator arity', () => {
    expect(
      errorsOf({ ...base, where: { field: 'user', op: 'isNull', value: 'x' } })[0]!.pointer
    ).toBe('/where/value');
    expect(
      errorsOf({ ...base, where: { field: 'user', op: 'in', value: 'x' } })[0]!.code
    ).toBe('invalid_type');
    expect(
      errorsOf({ ...base, where: { field: 'user', op: 'eq', value: ['x'] } })[0]!.code
    ).toBe('invalid_type');
    expect(
      errorsOf({ ...base, where: { field: 'cost.usd', op: 'between', value: [1] } })[0]!.code
    ).toBe('too_short');
  });

  it('limits filter depth, leaves and list sizes', () => {
    let deep: unknown = { field: 'user', op: 'isNull' };
    for (let i = 0; i < 7; i++) deep = { not: deep };
    expect(errorsOf({ ...base, where: deep }).some(error => error.code == 'too_deep')).toBe(
      true
    );

    let leaves = Array.from({ length: 101 }, () => ({ field: 'user', op: 'isNull' }));
    expect(errorsOf({ ...base, where: { and: leaves } })[0]!.code).toBe('too_long');

    let many = Array.from({ length: 1001 }, (_, index) => `u${index}`);
    expect(
      errorsOf({ ...base, where: { field: 'user', op: 'in', value: many } })[0]!.code
    ).toBe('too_long');
  });

  it('requires a version, dataset and range', () => {
    let errors = errorsOf({ dataset: 'nope' });
    expect(errors.map(error => error.pointer).sort()).toEqual(['/atq', '/dataset', '/range']);
  });

  it('validates measures', () => {
    expect(errorsOf({ ...base, measures: [{ fn: 'sum' }] })[0]!.pointer).toBe(
      '/measures/0/field'
    );
    expect(
      errorsOf({ ...base, measures: [{ fn: 'percentile', field: 'x', q: 1 }] })[0]!.pointer
    ).toBe('/measures/0/q');
    expect(
      errorsOf({ ...base, measures: [{ fn: 'p50', field: 'x', q: 0.5 }] })[0]!.pointer
    ).toBe('/measures/0/q');
    expect(parseQuery({ ...base, measures: [{ fn: 'count' }] }).ok).toBe(true);
  });

  it('validates expressions', () => {
    let errors = errorsOf({ ...base, derived: [{ as: 'x', expr: { divv: ['a', 'b'] } }] });
    expect(errors[0]!.pointer).toBe('/derived/0/expr');
    expect(errors[0]!.message).toContain('Did you mean "div"?');

    expect(
      errorsOf({ ...base, derived: [{ as: 'x', expr: { div: ['a'] } }] })[0]!.pointer
    ).toBe('/derived/0/expr/div');
    expect(
      parseQuery({
        ...base,
        derived: [
          { as: 'a', expr: { round: [{ mul: ['x', 100] }, 2] } },
          { as: 'b', expr: { movingAvg: ['x', 4] } },
          { as: 'c', expr: { shareWithin: ['x', 'team'] } }
        ]
      }).ok
    ).toBe(true);
  });

  it('rejects bad durations, dates and bins', () => {
    expect(errorsOf({ ...base, range: { last: '0d' } })[0]!.pointer).toBe('/range/last');
    expect(errorsOf({ ...base, range: { last: '7 days' } })[0]!.pointer).toBe('/range/last');
    expect(
      errorsOf({ ...base, range: { from: 'yesterday', to: '2026-01-01' } })[0]!.pointer
    ).toBe('/range/from');
    expect(
      errorsOf({ ...base, dimensions: [{ field: 'cost.usd', bins: [1, 1] }] })[0]!.code
    ).toBe('unsorted_bins');
  });

  it('escapes pointer segments', () => {
    let errors = errorsOf({ ...base, fill: { 'a/b': true } });
    expect(errors[0]!.pointer).toBe('/fill/a~1b');
  });
});

describe('querySchema', () => {
  it('describes the query and enumerates catalog names', () => {
    let schema = querySchema({ fields: ['team', 'user'], measures: ['cost.usd'] }) as any;

    expect(schema.required).toEqual(['atq', 'dataset', 'range']);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.dimensions.items.oneOf[0].enum).toEqual(['team', 'user']);
    expect(schema.properties.measures.items.oneOf[0].enum).toEqual(['cost.usd']);
    expect(schema.$defs.filter.oneOf).toHaveLength(4);
    expect(JSON.parse(JSON.stringify(schema))).toEqual(schema);
  });
});
