import { describe, expect, test } from 'vitest';
import { includes, notIncludes } from './includes';

describe('includes modifier', () => {
  test('returns an empty array if the value includes the substring', () => {
    let result = includes('foo')('foobar');
    expect(result).toEqual([]);
  });

  test('returns an error object if the value does not include the substring', () => {
    let result = includes('foo')('bar');
    expect(result).toEqual([
      {
        code: 'invalid_includes',
        message: 'Invalid substring, expected foo',
        expected: 'foo',
        received: 'bar'
      }
    ]);
  });

  test('allows a custom error message to be provided', () => {
    let result = includes('foo', { message: 'Custom error message' })('bar');
    expect(result).toEqual([
      {
        code: 'invalid_includes',
        message: 'Custom error message',
        expected: 'foo',
        received: 'bar'
      }
    ]);
  });
});

describe('notIncludes modifier', () => {
  test('returns an empty array if the value does not include the substring', () => {
    let result = notIncludes('foo')('bar');
    expect(result).toEqual([]);
  });

  test('returns an error object if the value includes the substring', () => {
    let result = notIncludes('foo')('foobar');
    expect(result).toEqual([
      {
        code: 'invalid_not_includes',
        message: 'Invalid substring, expected not foo',
        expected: 'foo',
        received: 'foobar'
      }
    ]);
  });

  test('allows a custom error message to be provided', () => {
    let result = notIncludes('foo', { message: 'Custom error message' })('foobar');
    expect(result).toEqual([
      {
        code: 'invalid_not_includes',
        message: 'Custom error message',
        expected: 'foo',
        received: 'foobar'
      }
    ]);
  });
});
