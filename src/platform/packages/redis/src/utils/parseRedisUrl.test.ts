import { describe, expect, test } from 'vitest';
import { parseRedisUrl } from './parseRedisUrl';

describe('parseRedisUrl', () => {
  test('should parse a valid Redis URL', () => {
    const url = 'redis://localhost:6379/0';
    const expected = {
      host: 'localhost',
      port: 6379,
      password: '',
      db: 0
    };

    const result = parseRedisUrl(url);

    expect(result).toEqual(expected);
  });

  test('should parse a Redis URL with password', () => {
    const url = 'redis://user:password@localhost:6379/0';
    const expected = {
      host: 'localhost',
      port: 6379,
      password: 'password',
      db: 0
    };

    const result = parseRedisUrl(url);

    expect(result).toEqual(expected);
  });

  test('should parse a Redis URL with a different database', () => {
    const url = 'redis://localhost:6379/1';
    const expected = {
      host: 'localhost',
      port: 6379,
      password: '',
      db: 1
    };

    const result = parseRedisUrl(url);

    expect(result).toEqual(expected);
  });
});
