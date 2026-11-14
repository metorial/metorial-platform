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

  test('should default to database 0 and port 6379', () => {
    expect(parseRedisUrl('redis://localhost')).toEqual({
      host: 'localhost',
      port: 6379,
      password: '',
      db: 0
    });
    expect(parseRedisUrl('redis://localhost:6380/')).toMatchObject({ port: 6380, db: 0 });
  });

  test('should decode a percent-encoded password', () => {
    let result = parseRedisUrl('rediss://:p%40ss%2Fw%3Ard@cache.internal:6379');
    expect(result.password).toBe('p@ss/w:rd');
    expect(result.db).toBe(0);
    expect(result.tls).toEqual({ rejectUnauthorized: false });
  });
});
