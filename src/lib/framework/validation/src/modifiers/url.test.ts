import { describe, expect, test } from 'vitest';
import { url } from './url';

describe('url', () => {
  test('should return an empty array for a valid URL', () => {
    let result = url()('https://example.com');
    expect(result).toEqual([]);
  });

  test('should return an error for an invalid URL', () => {
    let result = url()('not a url');
    expect(result).toEqual([
      {
        code: 'invalid_url',
        message: 'Invalid URL',
        received: 'not a url'
      }
    ]);
  });

  test('should return an error for a URL with an invalid hostname', () => {
    let result = url({ hostnames: ['example.com'] })('https://google.com');
    expect(result).toEqual([
      {
        code: 'invalid_hostname',
        message: 'Invalid hostname',
        expected: ['example.com'],
        received: 'google.com'
      }
    ]);
  });

  test('should return an empty array for a URL with a valid hostname', () => {
    let result = url({ hostnames: ['example.com'] })('https://example.com');
    expect(result).toEqual([]);
  });

  test('should use the provided error message', () => {
    let result = url({ message: 'Custom error message' })('not a url');
    expect(result).toEqual([
      {
        code: 'invalid_url',
        message: 'Custom error message',
        received: 'not a url'
      }
    ]);
  });
});
