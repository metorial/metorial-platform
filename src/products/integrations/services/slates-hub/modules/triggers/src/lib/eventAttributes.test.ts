import { describe, expect, it } from 'vitest';
import { normalizeEventAttributes } from './eventAttributes';

describe('normalizeEventAttributes', () => {
  it('keeps well-formed attributes', () => {
    expect(
      normalizeEventAttributes({ fileId: ['file_1'], mimeType: ['text/plain', 'text/csv'] })
    ).toEqual({ fileId: ['file_1'], mimeType: ['text/plain', 'text/csv'] });
  });

  it('keeps keys that name built-in object members', () => {
    let input = {
      constructor: ['a'],
      toString: ['b'],
      valueOf: ['c'],
      hasOwnProperty: ['d']
    };

    expect(normalizeEventAttributes(input)).toEqual(input);
  });

  it('accepts the limits: eight keys of sixteen values, 64-character keys, 256-character values', () => {
    let input = Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [
        i ? `key${i}` : 'k'.repeat(64),
        Array.from({ length: 16 }, (_, j) => `${j}`.padEnd(256, 'x'))
      ])
    );

    expect(normalizeEventAttributes(input)).toEqual(input);
  });

  it('returns null for anything that is not an object', () => {
    let inputs = [undefined, null, 'fileId', 42, true, ['fileId']];

    for (let input of inputs) expect(normalizeEventAttributes(input)).toBeNull();
  });

  it('returns null for an empty object', () => {
    expect(normalizeEventAttributes({})).toBeNull();
  });

  it.each([
    ['a key starting with a digit', { '9lives': ['a'] }],
    ['a key starting with an underscore', { _private: ['a'] }],
    ['a key with a dash', { 'mime-type': ['a'] }],
    ['a key with a colon', { 'a:b': ['a'] }],
    ['a key longer than 64 characters', { ['k'.repeat(65)]: ['a'] }],
    ['an empty value list', { fileId: [] }],
    ['an empty value', { fileId: [''] }],
    ['a value longer than 256 characters', { fileId: ['x'.repeat(257)] }],
    ['a non-string value', { fileId: [7] }],
    ['a bare string instead of a list', { fileId: 'file_1' }],
    ['more than sixteen values', { fileId: Array.from({ length: 17 }, (_, i) => `v${i}`) }],
    [
      'more than eight keys',
      Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`key${i}`, ['v']]))
    ]
  ])('drops all attributes of the event for %s', (_, invalid) => {
    expect(normalizeEventAttributes({ fileId: ['ok'], ...invalid })).toBeNull();
  });

  it('does not let prototype keys through', () => {
    let input = JSON.parse('{"__proto__": ["polluted"], "fileId": ["a"]}');

    let attributes = normalizeEventAttributes(input);

    expect(attributes).toEqual({ fileId: ['a'] });
    expect(Object.getPrototypeOf(attributes)).toBe(Object.prototype);
  });
});
