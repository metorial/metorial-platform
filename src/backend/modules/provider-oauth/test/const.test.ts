import { describe, expect, it } from 'vitest';
import { callbackUrl } from '../src/const';

describe('const', () => {
  describe('callbackUrl', () => {
    it('should be defined', () => {
      expect(callbackUrl).toBeDefined();
    });

    it('should be a string', () => {
      expect(typeof callbackUrl).toBe('string');
    });

    it('should be a valid URL', () => {
      expect(() => new URL(callbackUrl)).not.toThrow();
    });

    it('should use HTTPS protocol', () => {
      const url = new URL(callbackUrl);
      expect(url.protocol).toBe('https:');
    });

    it('should contain the callback path', () => {
      expect(callbackUrl).toContain('/provider-oauth/callback');
    });

    it('should end with /provider-oauth/callback', () => {
      expect(callbackUrl).toMatch(/\/provider-oauth\/callback$/);
    });

    it('should have a valid hostname', () => {
      const url = new URL(callbackUrl);
      expect(url.hostname).toBeTruthy();
      expect(url.hostname.length).toBeGreaterThan(0);
    });

    it('should not have query parameters', () => {
      const url = new URL(callbackUrl);
      expect(url.search).toBe('');
    });

    it('should not have a hash fragment', () => {
      const url = new URL(callbackUrl);
      expect(url.hash).toBe('');
    });
  });
});
