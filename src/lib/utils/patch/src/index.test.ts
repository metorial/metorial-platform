import { describe, expect, it } from 'vitest';
import {
  applyPatch,
  getAtPath,
  jsonEquals,
  PatchError,
  prefixPatch,
  type PatchOperation
} from './index';

describe('applyPatch', () => {
  it('sets a nested value and creates missing parent objects', () => {
    let result = applyPatch({ instances: {} } as any, [
      { op: 'set', path: ['instances', 'a', 'name'], value: 'x' }
    ]);

    expect(result).toEqual({ instances: { a: { name: 'x' } } });
  });

  it('replaces the root with an empty path', () => {
    expect(applyPatch({ a: 1 } as any, [{ op: 'set', path: [], value: { b: 2 } }])).toEqual({
      b: 2
    });
  });

  it('does not mutate the input', () => {
    let input = { instances: { a: ['x'] } };

    applyPatch(input, [{ op: 'add', path: ['instances', 'a'], value: 'y' }]);

    expect(input).toEqual({ instances: { a: ['x'] } });
  });

  it('adds to an array, creating it when missing', () => {
    let result = applyPatch({ instances: {} } as any, [
      { op: 'add', path: ['instances', 'a'], value: 'x' },
      { op: 'add', path: ['instances', 'a'], value: 'y' }
    ]);

    expect(result).toEqual({ instances: { a: ['x', 'y'] } });
  });

  it('adds idempotently using deep equality', () => {
    let result = applyPatch({ list: [{ id: 1 }] } as any, [
      { op: 'add', path: ['list'], value: { id: 1 } }
    ]);

    expect(result).toEqual({ list: [{ id: 1 }] });
  });

  it('removes array members and ignores missing paths', () => {
    let result = applyPatch({ list: ['a', 'b'] } as any, [
      { op: 'remove', path: ['list'], value: 'a' },
      { op: 'remove', path: ['missing', 'deep'], value: 'a' }
    ]);

    expect(result).toEqual({ list: ['b'] });
  });

  it('unsets keys and ignores missing ones', () => {
    let result = applyPatch({ a: { b: 1, c: 2 } } as any, [
      { op: 'unset', path: ['a', 'b'] },
      { op: 'unset', path: ['x', 'y'] }
    ]);

    expect(result).toEqual({ a: { c: 2 } });
  });

  it('is idempotent', () => {
    let operations: PatchOperation[] = [
      { op: 'add', path: ['a'], value: 'x' },
      { op: 'set', path: ['b', 'c'], value: 1 },
      { op: 'remove', path: ['a'], value: 'z' },
      { op: 'unset', path: ['d'] }
    ];

    let once = applyPatch({} as any, [...operations]);
    let twice = applyPatch(once, [...operations]);

    expect(twice).toEqual(once);
  });

  it('merges operations on disjoint paths regardless of order', () => {
    let a: PatchOperation = { op: 'add', path: ['pins'], value: 'a' };
    let b: PatchOperation = { op: 'add', path: ['pins'], value: 'b' };

    let ab = applyPatch({ pins: [] } as any, [a, b]) as any;
    let ba = applyPatch({ pins: [] } as any, [b, a]) as any;

    expect([...ab.pins].sort()).toEqual([...ba.pins].sort());
    expect(ab.pins).toHaveLength(2);
  });

  it('rejects traversal through non-objects', () => {
    expect(() =>
      applyPatch({ a: [] } as any, [{ op: 'set', path: ['a', 'b'], value: 1 }])
    ).toThrow(PatchError);
  });

  it('rejects add and remove on non-arrays', () => {
    expect(() => applyPatch({ a: 1 } as any, [{ op: 'add', path: ['a'], value: 1 }])).toThrow(
      PatchError
    );

    expect(() =>
      applyPatch({ a: {} } as any, [{ op: 'remove', path: ['a'], value: 1 }])
    ).toThrow(PatchError);
  });

  it('rejects operations without a value', () => {
    expect(() => applyPatch({} as any, [{ op: 'set', path: ['a'] } as any])).toThrow(
      PatchError
    );
  });

  it('rejects unsetting the root', () => {
    expect(() => applyPatch({} as any, [{ op: 'unset', path: [] }])).toThrow(PatchError);
  });

  it('rejects prototype-polluting path segments', () => {
    for (let segment of ['__proto__', 'constructor', 'prototype']) {
      expect(() =>
        applyPatch({} as any, [{ op: 'set', path: [segment, 'x'], value: 1 }])
      ).toThrow(PatchError);
    }

    expect(({} as any).x).toBeUndefined();
  });
});

describe('prefixPatch', () => {
  it('prefixes every path', () => {
    expect(
      prefixPatch(
        [
          { op: 'add', path: [], value: 'x' },
          { op: 'unset', path: ['k'] }
        ],
        ['instances', 'a']
      )
    ).toEqual([
      { op: 'add', path: ['instances', 'a'], value: 'x' },
      { op: 'unset', path: ['instances', 'a', 'k'] }
    ]);
  });
});

describe('getAtPath', () => {
  it('reads nested values and returns undefined for missing paths', () => {
    let value = { a: { b: ['x'] } };

    expect(getAtPath(value, ['a', 'b'])).toEqual(['x']);
    expect(getAtPath(value, ['a', 'c', 'd'])).toBeUndefined();
    expect(getAtPath(value, [])).toBe(value);
  });
});

describe('jsonEquals', () => {
  it('compares deeply', () => {
    expect(jsonEquals({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(jsonEquals({ a: [1] }, { a: [2] })).toBe(false);
    expect(jsonEquals([], {})).toBe(false);
  });
});
