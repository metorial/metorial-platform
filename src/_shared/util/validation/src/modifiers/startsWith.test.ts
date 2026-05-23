import { describe, expect, test } from 'vitest';
import { startsWith } from './startsWith';

describe('startsWith', () => {
  test('returns an empty array if the value starts with the prefix', () => {
    let prefix = 'hello';
    let value = 'hello world';
    let result = startsWith(prefix)(value);
    expect(result).toEqual([]);
  });

  test('returns an error object if the value does not start with the prefix', () => {
    let prefix = 'hello';
    let value = 'world';
    let result = startsWith(prefix)(value);
    expect(result).toEqual([
      {
        code: 'invalid_prefix',
        message: `Invalid prefix, expected ${prefix}`,
        expected: prefix,
        received: value
      }
    ]);
  });

  test('returns a custom error message if provided', () => {
    let prefix = 'hello';
    let value = 'world';
    let message = 'Value must start with hello';
    let result = startsWith(prefix, { message })(value);
    expect(result).toEqual([
      {
        code: 'invalid_prefix',
        message,
        expected: prefix,
        received: value
      }
    ]);
  });
});
