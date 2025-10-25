import { describe, expect, it } from 'vitest';
import {
  oauthConfigValidator,
  tokenResponseValidator,
  registrationResponseValidator,
  type OAuthConfiguration,
  type TokenResponse,
  type RegistrationResponse,
  type UserProfile
} from '../src/types';

describe('types and validators', () => {
  describe('oauthConfigValidator', () => {
    it('should validate a complete OAuth configuration', () => {
      const validConfig: OAuthConfiguration = {
        issuer: 'https://example.com',
        authorization_endpoint: 'https://example.com/oauth/authorize',
        token_endpoint: 'https://example.com/oauth/token',
        userinfo_endpoint: 'https://example.com/oauth/userinfo',
        registration_endpoint: 'https://example.com/oauth/register'
      };

      const result = oauthConfigValidator.validate(validConfig);
      expect(result.success).toBe(true);
    });

    it('should validate minimal OAuth configuration', () => {
      const minimalConfig = {
        authorization_endpoint: 'https://example.com/oauth/authorize',
        token_endpoint: 'https://example.com/oauth/token'
      };

      const result = oauthConfigValidator.validate(minimalConfig);
      expect(result.success).toBe(true);
    });

    it('should allow optional issuer', () => {
      const configWithoutIssuer = {
        authorization_endpoint: 'https://example.com/oauth/authorize',
        token_endpoint: 'https://example.com/oauth/token'
      };

      const result = oauthConfigValidator.validate(configWithoutIssuer);
      expect(result.success).toBe(true);
    });

    it('should allow optional userinfo_endpoint', () => {
      const configWithoutUserinfo = {
        issuer: 'https://example.com',
        authorization_endpoint: 'https://example.com/oauth/authorize',
        token_endpoint: 'https://example.com/oauth/token'
      };

      const result = oauthConfigValidator.validate(configWithoutUserinfo);
      expect(result.success).toBe(true);
    });

    it('should allow optional registration_endpoint', () => {
      const configWithoutRegistration = {
        issuer: 'https://example.com',
        authorization_endpoint: 'https://example.com/oauth/authorize',
        token_endpoint: 'https://example.com/oauth/token'
      };

      const result = oauthConfigValidator.validate(configWithoutRegistration);
      expect(result.success).toBe(true);
    });

    it('should reject config without authorization_endpoint', () => {
      const invalidConfig = {
        issuer: 'https://example.com',
        token_endpoint: 'https://example.com/oauth/token'
      };

      const result = oauthConfigValidator.validate(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject config without token_endpoint', () => {
      const invalidConfig = {
        issuer: 'https://example.com',
        authorization_endpoint: 'https://example.com/oauth/authorize'
      };

      const result = oauthConfigValidator.validate(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject invalid URL in authorization_endpoint', () => {
      const invalidConfig = {
        authorization_endpoint: 'not-a-valid-url',
        token_endpoint: 'https://example.com/oauth/token'
      };

      const result = oauthConfigValidator.validate(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject invalid URL in token_endpoint', () => {
      const invalidConfig = {
        authorization_endpoint: 'https://example.com/oauth/authorize',
        token_endpoint: 'not-a-valid-url'
      };

      const result = oauthConfigValidator.validate(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject invalid URL in userinfo_endpoint', () => {
      const invalidConfig = {
        authorization_endpoint: 'https://example.com/oauth/authorize',
        token_endpoint: 'https://example.com/oauth/token',
        userinfo_endpoint: 'not-a-valid-url'
      };

      const result = oauthConfigValidator.validate(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject non-object input', () => {
      const result = oauthConfigValidator.validate('not an object');
      expect(result.success).toBe(false);
    });

    it('should reject null input', () => {
      const result = oauthConfigValidator.validate(null);
      expect(result.success).toBe(false);
    });

    it('should reject array input', () => {
      const result = oauthConfigValidator.validate([]);
      expect(result.success).toBe(false);
    });
  });

  describe('tokenResponseValidator', () => {
    it('should validate a complete token response', () => {
      const validResponse: TokenResponse = {
        access_token: 'access-token-123',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'refresh-token-456',
        id_token: 'id-token-789',
        scope: 'openid profile email'
      };

      const result = tokenResponseValidator.validate(validResponse);
      expect(result.success).toBe(true);
    });

    it('should validate minimal token response', () => {
      const minimalResponse = {
        access_token: 'access-token-123'
      };

      const result = tokenResponseValidator.validate(minimalResponse);
      expect(result.success).toBe(true);
    });

    it('should allow optional token_type', () => {
      const response = {
        access_token: 'access-token-123'
      };

      const result = tokenResponseValidator.validate(response);
      expect(result.success).toBe(true);
    });

    it('should allow optional expires_in', () => {
      const response = {
        access_token: 'access-token-123',
        token_type: 'Bearer'
      };

      const result = tokenResponseValidator.validate(response);
      expect(result.success).toBe(true);
    });

    it('should allow optional refresh_token', () => {
      const response = {
        access_token: 'access-token-123',
        token_type: 'Bearer',
        expires_in: 3600
      };

      const result = tokenResponseValidator.validate(response);
      expect(result.success).toBe(true);
    });

    it('should allow optional id_token', () => {
      const response = {
        access_token: 'access-token-123',
        token_type: 'Bearer'
      };

      const result = tokenResponseValidator.validate(response);
      expect(result.success).toBe(true);
    });

    it('should allow optional scope', () => {
      const response = {
        access_token: 'access-token-123',
        token_type: 'Bearer'
      };

      const result = tokenResponseValidator.validate(response);
      expect(result.success).toBe(true);
    });

    it('should reject response without access_token', () => {
      const invalidResponse = {
        token_type: 'Bearer',
        expires_in: 3600
      };

      const result = tokenResponseValidator.validate(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject non-string access_token', () => {
      const invalidResponse = {
        access_token: 12345
      };

      const result = tokenResponseValidator.validate(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should handle numeric string expires_in', () => {
      const response = {
        access_token: 'token',
        expires_in: '3600'
      };

      const result = tokenResponseValidator.validate(response);
      // Validation library may coerce strings to numbers
      expect(result.success).toBe(true);
    });

    it('should reject null input', () => {
      const result = tokenResponseValidator.validate(null);
      expect(result.success).toBe(false);
    });
  });

  describe('registrationResponseValidator', () => {
    it('should validate a complete registration response', () => {
      const validResponse: RegistrationResponse = {
        client_id: 'client-id-123',
        client_secret: 'client-secret-456',
        client_id_issued_at: 1234567890,
        client_secret_expires_at: 1234567900,
        registration_access_token: 'reg-token-789',
        registration_client_uri: 'https://example.com/client/123'
      };

      const result = registrationResponseValidator.validate(validResponse);
      expect(result.success).toBe(true);
    });

    it('should validate minimal registration response', () => {
      const minimalResponse = {
        client_id: 'client-id-123'
      };

      const result = registrationResponseValidator.validate(minimalResponse);
      expect(result.success).toBe(true);
    });

    it('should allow optional client_secret', () => {
      const response = {
        client_id: 'client-id-123'
      };

      const result = registrationResponseValidator.validate(response);
      expect(result.success).toBe(true);
    });

    it('should allow optional timestamps', () => {
      const response = {
        client_id: 'client-id-123',
        client_secret: 'secret'
      };

      const result = registrationResponseValidator.validate(response);
      expect(result.success).toBe(true);
    });

    it('should reject response without client_id', () => {
      const invalidResponse = {
        client_secret: 'secret'
      };

      const result = registrationResponseValidator.validate(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject non-string client_id', () => {
      const invalidResponse = {
        client_id: 12345
      };

      const result = registrationResponseValidator.validate(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should handle numeric string timestamps', () => {
      const response = {
        client_id: 'client-id',
        client_id_issued_at: '1234567890'
      };

      const result = registrationResponseValidator.validate(response);
      // Validation library may coerce strings to numbers
      expect(result.success).toBe(true);
    });

    it('should reject null input', () => {
      const result = registrationResponseValidator.validate(null);
      expect(result.success).toBe(false);
    });
  });

  describe('UserProfile type', () => {
    it('should have correct structure', () => {
      const profile: UserProfile = {
        raw: { id: '123', name: 'Test User' },
        sub: '123',
        name: 'Test User',
        email: 'test@example.com'
      };

      expect(profile.raw).toBeDefined();
      expect(profile.sub).toBe('123');
      expect(profile.name).toBe('Test User');
      expect(profile.email).toBe('test@example.com');
    });

    it('should allow optional name', () => {
      const profile: UserProfile = {
        raw: { id: '123' },
        sub: '123'
      };

      expect(profile.name).toBeUndefined();
    });

    it('should allow optional email', () => {
      const profile: UserProfile = {
        raw: { id: '123' },
        sub: '123',
        name: 'Test User'
      };

      expect(profile.email).toBeUndefined();
    });
  });

  describe('OAuthConfiguration type', () => {
    it('should support all standard fields', () => {
      const config: OAuthConfiguration = {
        issuer: 'https://example.com',
        authorization_endpoint: 'https://example.com/authorize',
        token_endpoint: 'https://example.com/token',
        userinfo_endpoint: 'https://example.com/userinfo',
        response_types_supported: ['code', 'token'],
        scopes_supported: ['openid', 'profile'],
        token_endpoint_auth_methods_supported: ['client_secret_basic'],
        grant_types_supported: ['authorization_code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_alg_values_supported: ['RS256'],
        claims_supported: ['sub', 'name'],
        code_challenge_methods_supported: ['S256'],
        registration_endpoint: 'https://example.com/register'
      };

      expect(config).toBeDefined();
      expect(config.issuer).toBe('https://example.com');
    });
  });
});
