import { describe, expect, it } from 'vitest';
import { screenWebQuery, screenWebUrl, webDomainForLog } from '../src/webPolicy';

let token = 'aB3dE6gH9jK2mN5pQ8sT1vW4';

describe('review URL policy', () => {
  it('normalizes public HTTPS documentation URLs and removes tracking and fragments', () => {
    expect(
      screenWebUrl('https://DOCS.vendor.com:443/guide?lang=en&page=2&utm_source=docs#intro')
        .href
    ).toBe('https://docs.vendor.com/guide?lang=en&page=2');
  });

  it.each([
    'http://vendor.com/docs',
    'https://vendor.com:8443/docs',
    'https://user:pass@vendor.com/docs',
    'https://127.0.0.1/admin',
    'https://0x7f000001/admin',
    'https://[::1]/admin',
    'https://localhost/admin',
    'https://service.internal/admin',
    'https://vendor.com/?token=short',
    'https://vendor.com/?q=confidential',
    'https://vendor.com/docs/alice%40customer.com',
    'https://vendor.com/docs/alice%2540customer.com',
    'https://vendor.com/docs/%252540',
    'https://vendor.com/docs/%00',
    'https://vendor.com/docs/%250d%250a',
    `https://${token}.vendor.com/docs`,
    `https://vendor.com/${token}`,
    `https://vendor.com/?utm_source=${token}`,
    'https://vendor.com/invalid\npath',
    'https://vendor.com/\\admin'
  ])('blocks %s', input => {
    expect(() => screenWebUrl(input)).toThrow();
  });

  it('checks decoded text with the caller-supplied detector', () => {
    expect(() =>
      screenWebUrl('https://vendor.com/private%2Dvalue', value =>
        value.includes('private-value')
      )
    ).toThrow('sensitive_url');
  });

  it('redacts payload-shaped hostnames but preserves ordinary domains', () => {
    expect(webDomainForLog(`https://${token}.vendor.com/`)).toBe('[redacted]');
    expect(webDomainForLog('https://docs.vendor.com/?token=short')).toBe('docs.vendor.com');
    expect(webDomainForLog('invalid secret')).toBe('[redacted]');
  });
});

describe('review search query policy', () => {
  it('accepts short public documentation queries', () => {
    expect(screenWebQuery('  Vendor MCP OAuth documentation  ')).toBe(
      'Vendor MCP OAuth documentation'
    );
  });

  it.each([
    'alice@customer.com private account',
    'alice%2540customer.com private account',
    `documentation ${token}`,
    'password: hunter2',
    'x'.repeat(257),
    'Vendor\nprivate details',
    'site:https://vendor.com/?token=short'
  ])('blocks sensitive query %s', query => {
    expect(() => screenWebQuery(query)).toThrow();
  });
});
