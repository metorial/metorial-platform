import { describe, expect, it } from 'vitest';
import {
  evaluateRegisteredDomainSignup,
  normalizeRegisteredDomains
} from './registeredDomainPolicy';

describe('evaluateRegisteredDomainSignup', () => {
  it('allows a new user on a registered domain', () => {
    expect(
      evaluateRegisteredDomainSignup({
        domain: 'Acme.com',
        userExists: false,
        registeredDomains: ['acme.com']
      })
    ).toEqual({ allowed: true });
  });

  it('blocks a new user on an unregistered domain', () => {
    expect(
      evaluateRegisteredDomainSignup({
        domain: 'other.com',
        userExists: false,
        registeredDomains: ['acme.com']
      })
    ).toEqual({ allowed: false, reason: 'domain_not_registered' });
  });

  it('allows existing users on any domain', () => {
    expect(
      evaluateRegisteredDomainSignup({
        domain: 'other.com',
        userExists: true,
        registeredDomains: []
      })
    ).toEqual({ allowed: true });
  });

  it('blocks everyone new when no domain is registered', () => {
    expect(
      evaluateRegisteredDomainSignup({
        domain: 'acme.com',
        userExists: false,
        registeredDomains: []
      })
    ).toEqual({ allowed: false, reason: 'domain_not_registered' });
  });

  it('rejects malformed domains', () => {
    expect(
      evaluateRegisteredDomainSignup({
        domain: 'not a domain',
        userExists: false,
        registeredDomains: ['acme.com']
      })
    ).toEqual({ allowed: false, reason: 'invalid_domain' });
  });
});

describe('normalizeRegisteredDomains', () => {
  it('lowercases, dedupes and sorts', () => {
    expect(normalizeRegisteredDomains(['B.com', 'a.com', 'b.com'])).toEqual(['a.com', 'b.com']);
  });

  it('throws on invalid hostnames', () => {
    expect(() => normalizeRegisteredDomains(['a@b.com'])).toThrow();
  });
});
