import { describe, expect, it } from 'vitest';
import {
  isRedirectDomainMatch,
  normalizeRedirectDomain,
  normalizeRedirectDomains
} from './redirectDomains';

describe('redirectDomains', () => {
  it('normalizes wildcard and plain domains', () => {
    expect(normalizeRedirectDomain(' Example.com ')).toBe('example.com');
    expect(normalizeRedirectDomain(' *.Example.com ')).toBe('*.example.com');
    expect(normalizeRedirectDomain('example.com.')).toBe('example.com');
  });

  it('rejects malformed wildcard domains', () => {
    expect(() => normalizeRedirectDomain('*')).toThrowError(/Invalid redirect domain/);
    expect(() => normalizeRedirectDomain('*example.com')).toThrowError(
      /Invalid redirect domain/
    );
    expect(() => normalizeRedirectDomain('foo.*.example.com')).toThrowError(
      /Invalid redirect domain/
    );
    expect(() => normalizeRedirectDomain('https://example.com')).toThrowError(
      /Invalid redirect domain/
    );
  });

  it('deduplicates normalized domains', () => {
    expect(
      normalizeRedirectDomains(['Example.com', ' example.com ', '*.Example.com'])
    ).toEqual(['example.com', '*.example.com']);
  });

  it('matches wildcard subdomains but not the apex domain', () => {
    expect(isRedirectDomainMatch('api.example.com', '*.example.com')).toBe(true);
    expect(isRedirectDomainMatch('deep.api.example.com', '*.example.com')).toBe(true);
    expect(isRedirectDomainMatch('example.com', '*.example.com')).toBe(false);
    expect(isRedirectDomainMatch('evil-example.com', '*.example.com')).toBe(false);
  });

  it('matches exact hostnames case-insensitively', () => {
    expect(isRedirectDomainMatch('Example.com', 'example.com')).toBe(true);
    expect(isRedirectDomainMatch('api.example.com', 'example.com')).toBe(false);
  });
});

