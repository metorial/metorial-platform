import { describe, expect, it } from 'vitest';
import { parseStoreReplace } from './uploadForm';

describe('store_replace upload field', () => {
  it('defaults to false and accepts explicit booleans', () => {
    expect(parseStoreReplace(null, false)).toBe(false);
    expect(parseStoreReplace('false', true)).toBe(false);
    expect(parseStoreReplace('true', true)).toBe(true);
  });

  it('requires a linked store for replace mode', () => {
    expect(() => parseStoreReplace('true', false)).toThrow(/requires store_id and path/);
  });

  it('rejects invalid boolean values', () => {
    expect(() => parseStoreReplace('1', true)).toThrow(/must be true or false/);
  });
});
