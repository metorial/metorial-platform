import { ServiceError } from '@lowerdeck/error';
import { describe, expect, it } from 'vitest';
import { urlsMatch, validateRedirectUri, validateUri } from '../src/lib/oauthUrls';

describe('oauthUrls', () => {
  describe('validateUri', () => {
    it('allows https uris', () => {
      expect(() => validateUri('https://example.com/oauth/callback')).not.toThrow();
    });

    it.each([
      'http://localhost:3000/oauth/callback',
      'http://127.0.0.1:3000/oauth/callback',
      'http://[::1]:3000/oauth/callback'
    ])('allows local http uri %s', uri => {
      expect(() => validateUri(uri)).not.toThrow();
    });

    it('rejects non-local http uris', () => {
      expect(() => validateUri('http://example.com/oauth/callback')).toThrow(ServiceError);
    });

    it('rejects invalid uris', () => {
      expect(() => validateUri('not a url')).toThrow(ServiceError);
    });

    it('rejects uris with username or password', () => {
      expect(() => validateUri('https://user:password@example.com/oauth/callback')).toThrow(
        ServiceError
      );
    });
  });

  describe('urlsMatch', () => {
    it('matches protocol, hostname, port, and pathname', () => {
      expect(
        urlsMatch(
          'http://localhost:3000/oauth/callback?registered=1',
          'http://localhost:3000/oauth/callback?requested=1'
        )
      ).toBe(true);
    });

    it('rejects protocol mismatches', () => {
      expect(
        urlsMatch(
          'https://localhost:3000/oauth/callback',
          'http://localhost:3000/oauth/callback'
        )
      ).toBe(false);
    });
  });

  describe('validateRedirectUri', () => {
    it('allows redirect uris that match a registered uri', () => {
      expect(() =>
        validateRedirectUri({
          redirectUri: 'http://localhost:3000/oauth/callback',
          allowedRedirectUris: ['http://localhost:3000/oauth/callback']
        })
      ).not.toThrow();
    });

    it('rejects redirect uris that do not match a registered uri', () => {
      expect(() =>
        validateRedirectUri({
          redirectUri: 'http://localhost:3000/oauth/other',
          allowedRedirectUris: ['http://localhost:3000/oauth/callback']
        })
      ).toThrow(ServiceError);
    });
  });
});
