import { describe, expect, it } from 'vitest';
import { applyBatch } from './apply';
import { OpCode } from './types';

describe('applyBatch', () => {
  it('sets nested values and deletes keys', () => {
    let state = { name: 'alpha', nested: { count: 1 }, items: ['a', 'b'] };

    let updated = applyBatch(state, [
      1,
      [OpCode.Set, ['name'], 'beta'],
      [OpCode.Set, ['nested', 'count'], 2],
      [OpCode.Delete, ['items', 0]]
    ]);

    expect(updated).toEqual({
      name: 'beta',
      nested: { count: 2 },
      items: ['b']
    });
  });

  it('inserts into arrays and appends strings', () => {
    let state = { message: 'hi', tags: ['one'] };

    let updated = applyBatch(state, [
      2,
      [OpCode.StringAppend, ['message'], ' there'],
      [OpCode.ArrayInsert, ['tags'], 1, ['two']]
    ]);

    expect(updated).toEqual({
      message: 'hi there',
      tags: ['one', 'two']
    });
  });
});
