import { describe, expect, it } from 'vitest';
import { oauthErrorDescriptions } from '../src/lib/oauthErrors';

describe('oauthErrors', () => {
  describe('oauthErrorDescriptions', () => {
    it('should have descriptions for standard OAuth error codes', () => {
      expect(oauthErrorDescriptions.invalid_request).toBeDefined();
      expect(oauthErrorDescriptions.unauthorized_client).toBeDefined();
      expect(oauthErrorDescriptions.access_denied).toBeDefined();
      expect(oauthErrorDescriptions.unsupported_response_type).toBeDefined();
      expect(oauthErrorDescriptions.invalid_scope).toBeDefined();
      expect(oauthErrorDescriptions.server_error).toBeDefined();
      expect(oauthErrorDescriptions.temporarily_unavailable).toBeDefined();
    });

    it('should have descriptions for token error codes', () => {
      expect(oauthErrorDescriptions.invalid_client).toBeDefined();
      expect(oauthErrorDescriptions.invalid_grant).toBeDefined();
      expect(oauthErrorDescriptions.unsupported_grant_type).toBeDefined();
    });

    it('should have descriptions for OpenID Connect error codes', () => {
      expect(oauthErrorDescriptions.interaction_required).toBeDefined();
      expect(oauthErrorDescriptions.login_required).toBeDefined();
      expect(oauthErrorDescriptions.consent_required).toBeDefined();
      expect(oauthErrorDescriptions.account_selection_required).toBeDefined();
    });

    it('should have descriptions for provider-specific error codes', () => {
      // GitHub-specific
      expect(oauthErrorDescriptions.bad_verification_code).toBeDefined();
      expect(oauthErrorDescriptions.incorrect_client_credentials).toBeDefined();
    });

    it('should return string descriptions', () => {
      Object.entries(oauthErrorDescriptions).forEach(([key, value]) => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });

    it('should have meaningful error messages', () => {
      expect(oauthErrorDescriptions.invalid_request).toContain('required parameter');
      expect(oauthErrorDescriptions.access_denied).toContain('denied');
      expect(oauthErrorDescriptions.invalid_client).toContain('authentication failed');
      expect(oauthErrorDescriptions.invalid_grant).toContain('invalid or expired');
    });

    it('should handle edge cases with proper descriptions', () => {
      // Test that all error codes have non-empty descriptions
      const errorCodes = Object.keys(oauthErrorDescriptions);
      expect(errorCodes.length).toBeGreaterThan(10);

      errorCodes.forEach(code => {
        const description = oauthErrorDescriptions[code];
        expect(description).toBeTruthy();
        expect(description.trim().length).toBeGreaterThan(5);
      });
    });

    it('should be accessible as a record', () => {
      const record: Record<string, string> = oauthErrorDescriptions;
      expect(record).toBeDefined();
      expect(Object.keys(record).length).toBeGreaterThan(0);
    });
  });
});
