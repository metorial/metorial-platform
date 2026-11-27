import { describe, expect, it } from 'vitest';
import {
  assertSetupSessionRedirectUrl,
  isSetupSessionRedirectUrl,
  setupSessionRedirectUrlPattern
} from './setupSessionRedirectUrl';

describe('isSetupSessionRedirectUrl', () => {
  it.each([
    'https://app.example.com/oauth/callback',
    'https://app.example.com/done?state=abc#section',
    'http://localhost:3000/callback',
    'http://127.0.0.1:8080/',
    'HTTPS://APP.EXAMPLE.COM/callback',
    'https://user:pass@app.example.com:8443/path'
  ])('accepts %s', value => {
    expect(isSetupSessionRedirectUrl(value)).toBe(true);
  });

  it.each([
    '',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    '\tjavascript:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'blob:https://app.example.com/1',
    'file:///etc/passwd',
    'ftp://files.example.com/a',
    'myapp://callback',
    '/relative/path',
    '//app.example.com/path',
    'app.example.com/path',
    'https:app.example.com',
    'https:/app.example.com',
    ' https://app.example.com',
    'https://',
    'http://exa mple.com/'
  ])('rejects %j', value => {
    expect(isSetupSessionRedirectUrl(value)).toBe(false);
  });
});

describe('setupSessionRedirectUrlPattern', () => {
  it('matches only values that start with an http or https scheme', () => {
    expect(setupSessionRedirectUrlPattern.test('https://app.example.com')).toBe(true);
    expect(setupSessionRedirectUrlPattern.test('http://app.example.com')).toBe(true);
    expect(setupSessionRedirectUrlPattern.test('javascript:https://app.example.com')).toBe(
      false
    );
  });
});

describe('assertSetupSessionRedirectUrl', () => {
  it('allows a missing redirect url', () => {
    expect(() => assertSetupSessionRedirectUrl(undefined)).not.toThrow();
    expect(() => assertSetupSessionRedirectUrl(null)).not.toThrow();
  });

  it('allows an http or https url', () => {
    expect(() => assertSetupSessionRedirectUrl('https://app.example.com/cb')).not.toThrow();
  });

  it('throws a bad request for anything else', () => {
    expect(() => assertSetupSessionRedirectUrl('javascript:alert(1)')).toThrow(
      expect.objectContaining({ data: expect.objectContaining({ status: 400 }) })
    );
    expect(() => assertSetupSessionRedirectUrl('')).toThrow();
  });
});
