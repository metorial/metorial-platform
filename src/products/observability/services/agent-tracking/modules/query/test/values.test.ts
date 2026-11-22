import { describe, expect, it } from 'vitest';
import { allowsEntityFallback, filterValues } from '../src/lib/values';

describe('values search', () => {
  let values = [
    { value: 'aten_ada', label: { name: null, slug: null }, count: 5 },
    { value: 'aten_bob', label: { name: 'Bob', slug: null }, count: 3 },
    { value: null, label: null, count: 2 },
    { value: '$other', label: null, count: 1 }
  ];

  it('finds members by an email the search matched in the entities', () => {
    expect(
      filterValues({ values, search: 'ada@', matchingIds: new Set(['aten_ada']) }).map(
        item => item.value
      )
    ).toEqual(['aten_ada']);
  });

  it('still matches names and ids, and never returns null or other', () => {
    expect(
      filterValues({ values, search: 'bob', matchingIds: new Set() }).map(item => item.value)
    ).toEqual(['aten_bob']);
    expect(
      filterValues({ values, search: undefined, matchingIds: new Set() }).map(
        item => item.value
      )
    ).toEqual(['aten_ada', 'aten_bob']);
  });

  it('adds unseen entities only for callers without a project or instance scope', () => {
    expect(allowsEntityFallback(undefined)).toBe(true);
    expect(allowsEntityFallback({})).toBe(true);
    expect(allowsEntityFallback({ instanceIds: ['in_1'] })).toBe(false);
    expect(allowsEntityFallback({ projectIds: ['pr_1'] })).toBe(false);
  });
});
