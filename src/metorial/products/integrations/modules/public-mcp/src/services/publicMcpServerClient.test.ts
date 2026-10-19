import { describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {},
  getId: vi.fn(),
  ID: {},
  withTransaction: vi.fn()
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  resolveMetorialFacing: vi.fn()
}));

vi.mock('../internal/rateLimit', () => ({
  assertPublicMcpRateLimit: vi.fn(async () => {})
}));

import { validateRedirectUris } from './publicMcpServerClient';

let validate = (redirectUris: unknown, redirectUriFilters: string[] = []) =>
  validateRedirectUris({ server: { redirectUriFilters } as any, redirectUris });

let oauthError = (error: string) => expect.objectContaining({ error });

describe('redirect URI validation', () => {
  it.each([
    'http://127.0.0.1:56173/callback',
    'http://localhost:3000/callback',
    'http://app.localhost:3000/callback',
    'http://[::1]:8080/callback',
    'http://[::1]/callback',
    'https://client.example/callback',
    'cursor://anysphere.cursor-mcp/oauth/callback'
  ])('accepts %s', uri => {
    expect(validate([uri])).toEqual([uri]);
  });

  it.each([
    'http://example.com/callback',
    'http://192.168.0.1/callback',
    'http://[2001:db8::1]/callback',
    'http://localhost.evil.example/callback'
  ])('rejects plain http to %s', uri => {
    expect(() => validate([uri])).toThrow(oauthError('invalid_redirect_uri'));
  });

  it('rejects fragments and malformed lists', () => {
    expect(() => validate(['https://client.example/cb#frag'])).toThrow(
      oauthError('invalid_redirect_uri')
    );
    expect(() => validate([])).toThrow(oauthError('invalid_redirect_uri'));
    expect(() => validate('https://client.example/cb')).toThrow(
      oauthError('invalid_redirect_uri')
    );
  });
});
