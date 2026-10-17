import { afterEach, describe, expect, it } from 'vitest';
import { isLocalDevelopmentOrigin, isLocalhostOrigin } from './localDevelopmentOrigin';

let originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe('isLocalhostOrigin', () => {
  it('accepts localhost and .localhost subdomains', () => {
    expect(isLocalhostOrigin('http://localhost:4300')).toBe(true);
    expect(isLocalhostOrigin('http://127.0.0.1:4300')).toBe(true);
    expect(isLocalhostOrigin('http://[::1]:4300')).toBe(true);
    expect(isLocalhostOrigin('http://metorial-feat-x.localhost:4300')).toBe(true);
  });

  it('rejects other origins', () => {
    expect(isLocalhostOrigin('https://metorial.com')).toBe(false);
    expect(isLocalhostOrigin('https://localhost.evil.com')).toBe(false);
    expect(isLocalhostOrigin('https://evillocalhost')).toBe(false);
    expect(isLocalhostOrigin('file://localhost')).toBe(false);
    expect(isLocalhostOrigin('null')).toBe(false);
    expect(isLocalhostOrigin('')).toBe(false);
    expect(isLocalhostOrigin(undefined)).toBe(false);
  });
});

describe('isLocalDevelopmentOrigin', () => {
  it('only allows localhost origins in development', () => {
    process.env.NODE_ENV = 'development';
    expect(isLocalDevelopmentOrigin('http://a.localhost:4300')).toBe(true);

    process.env.NODE_ENV = 'production';
    expect(isLocalDevelopmentOrigin('http://a.localhost:4300')).toBe(false);
  });
});
