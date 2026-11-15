import { describe, expect, it } from 'vitest';
import { versionKey } from '@mtsrc/agent-tracking-spec';
import { evaluateExpr, exprReferences, isWindowExpr, needsTimeDimension } from '../src';

let values: Record<string, number | null> = { a: 6, b: 3, zero: 0, missing: null };
let value = (name: string) => values[name] ?? null;

describe('evaluateExpr', () => {
  it('computes arithmetic', () => {
    expect(evaluateExpr({ add: ['a', 'b', 1] }, { value })).toBe(10);
    expect(evaluateExpr({ sub: ['a', 'b'] }, { value })).toBe(3);
    expect(evaluateExpr({ mul: ['a', 'b'] }, { value })).toBe(18);
    expect(evaluateExpr({ div: ['a', 'b'] }, { value })).toBe(2);
    expect(evaluateExpr({ round: [{ div: ['b', 7] }, 2] }, { value })).toBe(0.43);
    expect(evaluateExpr({ abs: { sub: ['b', 'a'] } }, { value })).toBe(3);
    expect(evaluateExpr({ min: ['a', 'b', 'missing'] }, { value })).toBe(3);
    expect(evaluateExpr({ max: ['a', 'b'] }, { value })).toBe(6);
  });

  it('gives null for division by zero and missing inputs', () => {
    expect(evaluateExpr({ div: ['a', 'zero'] }, { value })).toBeNull();
    expect(evaluateExpr({ div: ['a', 'missing'] }, { value })).toBeNull();
    expect(evaluateExpr({ add: ['a', 'missing'] }, { value })).toBeNull();
    expect(evaluateExpr({ coalesce: ['missing', 'b'] }, { value })).toBe(3);
  });

  it('delegates window expressions', () => {
    expect(
      evaluateExpr({ mul: [{ shareOfTotal: 'a' }, 100] }, { value, window: () => 0.25 })
    ).toBe(25);
    expect(evaluateExpr({ rank: 'a' }, { value })).toBeNull();
  });

  it('lists references and window needs', () => {
    expect(exprReferences({ div: ['a', { shareWithin: ['b', 'team'] }] })).toEqual({
      measures: ['a', 'b'],
      dimensions: ['team']
    });
    expect(needsTimeDimension({ add: [{ cumulative: 'a' }, 1] })).toBe(true);
    expect(needsTimeDimension({ shareOfTotal: 'a' })).toBe(false);
    expect(isWindowExpr({ rank: 'a' })).toBe(true);
    expect(isWindowExpr({ add: ['a'] })).toBe(false);
  });
});

describe('versionKey', () => {
  it('sorts like semver', () => {
    let versions = [
      '2.0.10',
      '2.0.9',
      '10.0.0',
      '2.0.10-beta.1',
      'v1.2',
      'nightly',
      '2.0.10+build'
    ];
    let sorted = [...versions].sort((a, b) => (versionKey(a)! < versionKey(b)! ? -1 : 1));

    expect(sorted).toEqual([
      'v1.2',
      '2.0.9',
      '2.0.10-beta.1',
      '2.0.10',
      '2.0.10+build',
      '10.0.0',
      'nightly'
    ]);
    expect(versionKey('2.0.10')).toBe(versionKey('2.0.10+build'));
    expect(versionKey(undefined)).toBeUndefined();
  });
});
