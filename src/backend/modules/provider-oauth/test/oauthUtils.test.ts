import axios from 'axios';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { OAuthUtils } from '../src/lib/oauthUtils';
import { OAuthConfiguration } from '../src/types';

// Mock external dependencies
vi.mock('@metorial/canonicalize', () => ({
  canonicalize: vi.fn((obj) => JSON.stringify(obj))
}));

vi.mock('@metorial/db', () => ({
  db: {
    providerOAuthRegistrationError: {
      create: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn(() => 'test-id')
  }
}));

vi.mock('@metorial/hash', () => ({
  Hash: {
    sha256: vi.fn(async (str) => {
      // Simple hash simulation that produces different output for different inputs
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
      }
      return `hash-${Math.abs(hash).toString(16)}`;
    })
  }
}));

vi.mock('@metorial/sentry', () => ({
  getSentry: vi.fn(() => ({
    captureException: vi.fn()
  }))
}));

vi.mock('@metorial/ssrf', () => ({
  getAxiosSsrfFilter: vi.fn(() => ({}))
}));

vi.mock('axios');

describe('OAuthUtils', () => {
  const mockConfig: OAuthConfiguration = {
    issuer: 'https://example.com',
    authorization_endpoint: 'https://example.com/oauth/authorize',
    token_endpoint: 'https://example.com/oauth/token',
    userinfo_endpoint: 'https://example.com/oauth/userinfo',
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post']
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateState', () => {
    it('should generate a state string', () => {
      const state = OAuthUtils.generateState();
      expect(state).toBeDefined();
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(0);
    });

    it('should generate unique states', () => {
      const state1 = OAuthUtils.generateState();
      const state2 = OAuthUtils.generateState();
      expect(state1).not.toBe(state2);
    });

    it('should generate state with appropriate length', () => {
      const state = OAuthUtils.generateState();
      expect(state.length).toBeGreaterThan(20);
    });
  });

  describe('generateCodeVerifier', () => {
    it('should generate a code verifier', () => {
      const verifier = OAuthUtils.generateCodeVerifier();
      expect(verifier).toBeDefined();
      expect(typeof verifier).toBe('string');
      expect(verifier.length).toBeGreaterThan(0);
    });

    it('should generate unique verifiers', () => {
      const verifier1 = OAuthUtils.generateCodeVerifier();
      const verifier2 = OAuthUtils.generateCodeVerifier();
      expect(verifier1).not.toBe(verifier2);
    });

    it('should generate verifier with appropriate length', () => {
      const verifier = OAuthUtils.generateCodeVerifier();
      // PKCE verifier should be at least 43 characters
      expect(verifier.length).toBeGreaterThan(43);
    });
  });

  describe('generateCodeChallenge', () => {
    it('should generate a code challenge from verifier', async () => {
      const verifier = 'test-verifier-123';
      const challenge = await OAuthUtils.generateCodeChallenge(verifier);

      expect(challenge).toBeDefined();
      expect(typeof challenge).toBe('string');
      expect(challenge.length).toBeGreaterThan(0);
    });

    it('should generate consistent challenges for same verifier', async () => {
      const verifier = 'test-verifier-456';
      const challenge1 = await OAuthUtils.generateCodeChallenge(verifier);
      const challenge2 = await OAuthUtils.generateCodeChallenge(verifier);

      expect(challenge1).toBe(challenge2);
    });

    it('should generate different challenges for different verifiers', async () => {
      const verifier1 = 'verifier-1';
      const verifier2 = 'verifier-2';

      const challenge1 = await OAuthUtils.generateCodeChallenge(verifier1);
      const challenge2 = await OAuthUtils.generateCodeChallenge(verifier2);

      expect(challenge1).not.toBe(challenge2);
    });

    it('should generate base64url encoded challenge', async () => {
      const verifier = 'test-verifier';
      const challenge = await OAuthUtils.generateCodeChallenge(verifier);

      // Base64url should not contain +, /, or =
      expect(challenge).not.toMatch(/[+/=]/);
    });
  });

  describe('buildAuthorizationUrl', () => {
    it('should build authorization URL with required parameters', () => {
      const url = OAuthUtils.buildAuthorizationUrl({
        authEndpoint: 'https://example.com/authorize',
        clientId: 'test-client-id',
        redirectUri: 'https://app.example.com/callback',
        scopes: ['openid', 'profile']
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
      expect(parsed.searchParams.get('redirect_uri')).toBe('https://app.example.com/callback');
      expect(parsed.searchParams.get('scope')).toBe('openid profile');
    });

    it('should include state parameter when provided', () => {
      const url = OAuthUtils.buildAuthorizationUrl({
        authEndpoint: 'https://example.com/authorize',
        clientId: 'test-client',
        redirectUri: 'https://app.example.com/callback',
        scopes: [],
        state: 'test-state-123'
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.get('state')).toBe('test-state-123');
    });

    it('should include PKCE parameters when provided', () => {
      const url = OAuthUtils.buildAuthorizationUrl({
        authEndpoint: 'https://example.com/authorize',
        clientId: 'test-client',
        redirectUri: 'https://app.example.com/callback',
        scopes: [],
        codeChallenge: 'test-challenge'
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.get('code_challenge')).toBe('test-challenge');
      expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    });

    it('should handle empty scopes array', () => {
      const url = OAuthUtils.buildAuthorizationUrl({
        authEndpoint: 'https://example.com/authorize',
        clientId: 'test-client',
        redirectUri: 'https://app.example.com/callback',
        scopes: []
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.has('scope')).toBe(false);
    });

    it('should properly encode URL parameters', () => {
      const url = OAuthUtils.buildAuthorizationUrl({
        authEndpoint: 'https://example.com/authorize',
        clientId: 'test-client',
        redirectUri: 'https://app.example.com/callback?param=value',
        scopes: ['scope:read', 'scope:write']
      });

      expect(url).toContain('redirect_uri=https%3A%2F%2F');
      expect(url).toContain('scope=scope%3Aread+scope%3Awrite');
    });
  });

  describe('getProviderName', () => {
    it('should extract provider name from issuer', () => {
      const name = OAuthUtils.getProviderName({
        issuer: 'https://auth.example.com',
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token'
      });

      expect(name).toBe('example.com');
    });

    it('should extract provider name from authorization endpoint if no issuer', () => {
      const name = OAuthUtils.getProviderName({
        authorization_endpoint: 'https://login.provider.com/oauth/authorize',
        token_endpoint: 'https://login.provider.com/oauth/token'
      });

      expect(name).toBe('provider.com');
    });

    it('should handle invalid URLs gracefully', () => {
      const name = OAuthUtils.getProviderName({
        issuer: 'not-a-valid-url',
        authorization_endpoint: 'https://example.com/authorize',
        token_endpoint: 'https://example.com/token'
      });

      expect(name).toBeDefined();
      expect(typeof name).toBe('string');
    });

    it('should return default when no valid endpoints', () => {
      const name = OAuthUtils.getProviderName({
        authorization_endpoint: '',
        token_endpoint: ''
      });

      expect(name).toBe('OAuth Provider');
    });

    it('should handle subdomain correctly', () => {
      const name = OAuthUtils.getProviderName({
        issuer: 'https://auth.subdomain.example.com',
        authorization_endpoint: 'https://auth.subdomain.example.com/authorize',
        token_endpoint: 'https://auth.subdomain.example.com/token'
      });

      expect(name).toBe('example.com');
    });
  });

  describe('getProviderUrl', () => {
    it('should construct provider URL from issuer', () => {
      const url = OAuthUtils.getProviderUrl({
        issuer: 'https://auth.example.com',
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token'
      });

      expect(url).toBe('https://example.com');
    });

    it('should construct provider URL from authorization endpoint if no issuer', () => {
      const url = OAuthUtils.getProviderUrl({
        authorization_endpoint: 'https://login.provider.com/oauth/authorize',
        token_endpoint: 'https://login.provider.com/oauth/token'
      });

      expect(url).toBe('https://provider.com');
    });

    it('should return https URL', () => {
      const url = OAuthUtils.getProviderUrl(mockConfig);
      expect(url).toMatch(/^https:\/\//);
    });

    it('should return default URL when no valid endpoints', () => {
      const url = OAuthUtils.getProviderUrl({
        authorization_endpoint: '',
        token_endpoint: ''
      });

      expect(url).toBe('https://unknown-provider.metorial.com');
    });
  });

  describe('getConfigHash', () => {
    it('should generate hash for config and scopes', async () => {
      const hash = await OAuthUtils.getConfigHash(mockConfig, ['openid', 'profile']);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('should generate consistent hash for same config', async () => {
      const hash1 = await OAuthUtils.getConfigHash(mockConfig, ['openid']);
      const hash2 = await OAuthUtils.getConfigHash(mockConfig, ['openid']);

      expect(hash1).toBe(hash2);
    });

    it('should sort scopes for consistent hashing', async () => {
      const hash1 = await OAuthUtils.getConfigHash(mockConfig, ['profile', 'openid']);
      const hash2 = await OAuthUtils.getConfigHash(mockConfig, ['openid', 'profile']);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different configs', async () => {
      const config2: OAuthConfiguration = {
        ...mockConfig,
        issuer: 'https://different.com'
      };

      const hash1 = await OAuthUtils.getConfigHash(mockConfig, ['openid']);
      const hash2 = await OAuthUtils.getConfigHash(config2, ['openid']);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange authorization code for tokens', async () => {
      const mockTokenResponse = {
        access_token: 'access-token-123',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'refresh-token-456'
      };

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: mockTokenResponse,
        status: 200
      });

      const result = await OAuthUtils.exchangeCodeForTokens({
        tokenEndpoint: 'https://example.com/token',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        code: 'auth-code-123',
        redirectUri: 'https://app.example.com/callback',
        config: mockConfig
      });

      expect(result).toEqual(mockTokenResponse);
      expect(axios.post).toHaveBeenCalled();
    });

    it('should use Basic auth when supported', async () => {
      const mockTokenResponse = {
        access_token: 'token'
      };

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: mockTokenResponse,
        status: 200
      });

      await OAuthUtils.exchangeCodeForTokens({
        tokenEndpoint: 'https://example.com/token',
        clientId: 'client',
        clientSecret: 'secret',
        code: 'code',
        redirectUri: 'https://app.example.com/callback',
        config: mockConfig
      });

      const callArgs = vi.mocked(axios.post).mock.calls[0];
      const headers = callArgs[2]?.headers as Record<string, string>;

      expect(headers.Authorization).toMatch(/^Basic /);
    });

    it('should include client_id for public clients without secret', async () => {
      const mockTokenResponse = {
        access_token: 'token'
      };

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: mockTokenResponse,
        status: 200
      });

      await OAuthUtils.exchangeCodeForTokens({
        tokenEndpoint: 'https://example.com/token',
        clientId: 'public-client',
        code: 'code',
        redirectUri: 'https://app.example.com/callback',
        config: mockConfig
      });

      const callArgs = vi.mocked(axios.post).mock.calls[0];
      const body = callArgs[1] as string;

      expect(body).toContain('client_id=public-client');
    });

    it('should include code_verifier when provided', async () => {
      const mockTokenResponse = {
        access_token: 'token'
      };

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: mockTokenResponse,
        status: 200
      });

      await OAuthUtils.exchangeCodeForTokens({
        tokenEndpoint: 'https://example.com/token',
        clientId: 'client',
        clientSecret: 'secret',
        code: 'code',
        redirectUri: 'https://app.example.com/callback',
        codeVerifier: 'verifier-123',
        config: mockConfig
      });

      const callArgs = vi.mocked(axios.post).mock.calls[0];
      const body = callArgs[1] as string;

      expect(body).toContain('code_verifier=verifier-123');
    });

    it('should throw ServiceError on failure', async () => {
      vi.mocked(axios.post).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        OAuthUtils.exchangeCodeForTokens({
          tokenEndpoint: 'https://example.com/token',
          clientId: 'client',
          clientSecret: 'secret',
          code: 'code',
          redirectUri: 'https://app.example.com/callback',
          config: mockConfig
        })
      ).rejects.toThrow();
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token successfully', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: mockTokenResponse,
        status: 200
      });

      const result = await OAuthUtils.refreshAccessToken({
        tokenEndpoint: 'https://example.com/token',
        clientId: 'client',
        clientSecret: 'secret',
        refreshToken: 'refresh-token',
        config: mockConfig
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.response).toEqual(mockTokenResponse);
      }
    });

    it('should handle refresh failure gracefully', async () => {
      vi.mocked(axios.post).mockRejectedValueOnce({
        response: {
          data: { error_description: 'Token expired' }
        }
      });

      const result = await OAuthUtils.refreshAccessToken({
        tokenEndpoint: 'https://example.com/token',
        clientId: 'client',
        clientSecret: 'secret',
        refreshToken: 'expired-token',
        config: mockConfig
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain('Token expired');
      }
    });

    it('should work with public clients (no secret)', async () => {
      const mockTokenResponse = {
        access_token: 'token'
      };

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: mockTokenResponse,
        status: 200
      });

      const result = await OAuthUtils.refreshAccessToken({
        tokenEndpoint: 'https://example.com/token',
        clientId: 'public-client',
        refreshToken: 'refresh-token',
        config: mockConfig
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('getUserProfile', () => {
    it('should fetch user profile successfully', async () => {
      const mockProfile = {
        sub: '123456',
        name: 'John Doe',
        email: 'john@example.com',
        picture: 'https://example.com/avatar.jpg'
      };

      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockProfile,
        status: 200
      });

      const result = await OAuthUtils.getUserProfile({
        userInfoEndpoint: 'https://example.com/userinfo',
        accessToken: 'access-token'
      });

      expect(result).toEqual({
        raw: mockProfile,
        sub: '123456',
        name: 'John Doe',
        email: 'john@example.com'
      });
    });

    it('should handle missing sub by using id field', async () => {
      const mockProfile = {
        id: '789',
        name: 'Jane Doe'
      };

      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockProfile,
        status: 200
      });

      const result = await OAuthUtils.getUserProfile({
        userInfoEndpoint: 'https://example.com/userinfo',
        accessToken: 'access-token'
      });

      expect(result?.sub).toBe('789');
    });

    it('should handle missing sub by using user_id field', async () => {
      const mockProfile = {
        user_id: 'user-123',
        name: 'Bob Smith'
      };

      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockProfile,
        status: 200
      });

      const result = await OAuthUtils.getUserProfile({
        userInfoEndpoint: 'https://example.com/userinfo',
        accessToken: 'access-token'
      });

      expect(result?.sub).toBe('user-123');
    });

    it('should return null when no sub identifier found', async () => {
      const mockProfile = {
        name: 'No ID User'
      };

      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockProfile,
        status: 200
      });

      const result = await OAuthUtils.getUserProfile({
        userInfoEndpoint: 'https://example.com/userinfo',
        accessToken: 'access-token'
      });

      expect(result).toBeNull();
    });

    it('should throw ServiceError on failure', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Unauthorized'));

      await expect(
        OAuthUtils.getUserProfile({
          userInfoEndpoint: 'https://example.com/userinfo',
          accessToken: 'invalid-token'
        })
      ).rejects.toThrow();
    });

    it('should handle optional fields', async () => {
      const mockProfile = {
        sub: '999'
        // no name or email
      };

      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockProfile,
        status: 200
      });

      const result = await OAuthUtils.getUserProfile({
        userInfoEndpoint: 'https://example.com/userinfo',
        accessToken: 'access-token'
      });

      expect(result).toEqual({
        raw: mockProfile,
        sub: '999',
        name: undefined,
        email: undefined
      });
    });
  });

  describe('registerClient', () => {
    it('should register client successfully', async () => {
      const mockRegistration = {
        client_id: 'new-client-id',
        client_secret: 'new-client-secret',
        client_id_issued_at: 1234567890
      };

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: mockRegistration,
        status: 201
      });

      const result = await OAuthUtils.registerClient(
        { clientName: 'Test App' },
        {
          ...mockConfig,
          registration_endpoint: 'https://example.com/register'
        }
      );

      expect(result).toBeDefined();
      expect(result?.client_id).toBe('new-client-id');
      expect(result?.client_secret).toBe('new-client-secret');
    });

    it('should return null when no registration endpoint', async () => {
      const result = await OAuthUtils.registerClient(
        { clientName: 'Test App' },
        mockConfig
      );

      expect(result).toBeNull();
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('should handle registration failure gracefully', async () => {
      vi.mocked(axios.post).mockRejectedValueOnce(new Error('Registration failed'));

      const result = await OAuthUtils.registerClient(
        { clientName: 'Test App' },
        {
          ...mockConfig,
          registration_endpoint: 'https://example.com/register'
        }
      );

      expect(result).toBeNull();
    });

    it('should handle invalid registration response', async () => {
      vi.mocked(axios.post).mockResolvedValueOnce({
        data: { invalid: 'response' },
        status: 201
      });

      const result = await OAuthUtils.registerClient(
        { clientName: 'Test App' },
        {
          ...mockConfig,
          registration_endpoint: 'https://example.com/register'
        }
      );

      // Invalid response should return null, not throw
      expect(result).toBeNull();
    });

    it('should convert timestamps correctly', async () => {
      const mockRegistration = {
        client_id: 'client-id',
        client_id_issued_at: 1609459200, // 2021-01-01 00:00:00 UTC
        client_secret_expires_at: 1640995200 // 2022-01-01 00:00:00 UTC
      };

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: mockRegistration,
        status: 201
      });

      const result = await OAuthUtils.registerClient(
        { clientName: 'Test App' },
        {
          ...mockConfig,
          registration_endpoint: 'https://example.com/register'
        }
      );

      expect(result?.client_id_issued_at).toBeInstanceOf(Date);
      expect(result?.client_secret_expires_at).toBeInstanceOf(Date);
    });
  });
});
