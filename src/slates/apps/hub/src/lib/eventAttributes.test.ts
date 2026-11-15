import { describe, expect, it } from 'vitest';
import { normalizeEventAttributes } from './eventAttributes';

describe('normalizeEventAttributes', () => {
  it('keeps well-formed attributes', () => {
    expect(
      normalizeEventAttributes({ fileId: ['file_1'], mimeType: ['text/plain', 'text/csv'] })
    ).toEqual({ fileId: ['file_1'], mimeType: ['text/plain', 'text/csv'] });
  });

  it('returns null for anything that is not a plain object', () => {
    let inputs = [undefined, null, 'fileId', 42, true, ['fileId'], new Date(), new Map()];

    for (let input of inputs) expect(normalizeEventAttributes(input)).toBeNull();
  });

  it('returns null when nothing valid remains', () => {
    expect(normalizeEventAttributes({})).toBeNull();
    expect(normalizeEventAttributes({ fileId: [] })).toBeNull();
    expect(normalizeEventAttributes({ '1bad': ['value'], fileId: [1, null, ''] })).toBeNull();
  });

  it('drops keys that do not match the key pattern', () => {
    expect(
      normalizeEventAttributes({
        fileId: ['a'],
        file_id_2: ['b'],
        _private: ['c'],
        '9lives': ['d'],
        'mime-type': ['e'],
        'has space': ['f'],
        ['k'.repeat(65)]: ['g'],
        ['k'.repeat(64)]: ['h']
      })
    ).toEqual({ fileId: ['a'], file_id_2: ['b'], ['k'.repeat(64)]: ['h'] });
  });

  it('keeps only non-empty strings within the length limit', () => {
    expect(
      normalizeEventAttributes({
        fileId: ['ok', '', 'x'.repeat(257), 'x'.repeat(256), 7, null, { id: 'a' }, ['nested']]
      })
    ).toEqual({ fileId: ['ok', 'x'.repeat(256)] });
  });

  it('accepts a single string value as a one-element list', () => {
    expect(normalizeEventAttributes({ fileId: 'file_1', count: 3 })).toEqual({
      fileId: ['file_1']
    });
  });

  it('de-duplicates values and caps them at 16 per key', () => {
    let values = Array.from({ length: 20 }, (_, index) => `value_${index}`);

    expect(normalizeEventAttributes({ fileId: ['a', 'a', 'b', 'a'] })).toEqual({
      fileId: ['a', 'b']
    });
    expect(normalizeEventAttributes({ fileId: [...values, ...values] })).toEqual({
      fileId: values.slice(0, 16)
    });
  });

  it('caps the number of keys at 8, counting only keys that kept values', () => {
    let input: Record<string, unknown> = { empty: [], invalid: [1] };
    for (let index = 0; index < 10; index++) input[`key${index}`] = [`value${index}`];

    let attributes = normalizeEventAttributes(input);

    expect(Object.keys(attributes!)).toEqual([
      'key0',
      'key1',
      'key2',
      'key3',
      'key4',
      'key5',
      'key6',
      'key7'
    ]);
  });

  it('never throws on hostile input', () => {
    let hostile = {
      get fileId() {
        throw new Error('boom');
      }
    };

    expect(normalizeEventAttributes(hostile)).toBeNull();
  });

  it('does not let prototype keys through', () => {
    let input = JSON.parse('{"__proto__": ["polluted"], "fileId": ["a"]}');

    let attributes = normalizeEventAttributes(input);

    expect(attributes).toEqual({ fileId: ['a'] });
    expect(Object.getPrototypeOf(attributes)).toBe(Object.prototype);
  });
});
