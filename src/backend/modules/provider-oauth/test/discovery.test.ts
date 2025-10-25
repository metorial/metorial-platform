import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OAuthDiscovery } from '../src/lib/discovery';
import { OAuthConfiguration } from '../src/types';
import type { AxiosResponse } from 'axios';

// Mock dependencies
vi.mock('@metorial/axios-sse', () => ({
  axiosWithoutSse: vi.fn()
}));

vi.mock('@metorial/ssrf', () => ({
  getAxiosSsrfFilter: vi.fn(() => ({}))
}));

// Import after mocking
import { axiosWithoutSse } from '@metorial/axios-sse';

// Helper to create mock axios response
const createMockResponse = <T>(data: T, status: number = 200, headers: any = {}): Partial<AxiosResponse<T>> => ({
  data,
  status,
  statusText: status === 200 ? 'OK' : status === 404 ? 'Not Found' : status === 401 ? 'Unauthorized' : 'Error',
  headers,
  config: {} as any
});

describe('OAuthDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('discover', () => {
    const validConfig: OAuthConfiguration = {
      issuer: 'https://example.com',
      authorization_endpoint: 'https://example.com/oauth/authorize',
      token_endpoint: 'https://example.com/oauth/token',
      userinfo_endpoint: 'https://example.com/oauth/userinfo'
    };

    it('should discover OAuth configuration from well-known endpoint', async () => {
      vi.mocked(axiosWithoutSse).mockResolvedValueOnce(
        createMockResponse(validConfig, 200) as any
      );

      const result = await OAuthDiscovery.discover('https://example.com');

      expect(result).toEqual(validConfig);
      expect(axiosWithoutSse).toHaveBeenCalled();
    });

    it('should return null for non-https URLs', async () => {
      const result = await OAuthDiscovery.discover('http://example.com');

      expect(result).toBeNull();
      expect(axiosWithoutSse).not.toHaveBeenCalled();
    });

    it('should try multiple well-known paths', async () => {
      vi.mocked(axiosWithoutSse)
        .mockResolvedValueOnce(createMockResponse({}, 404) as any)
        .mockResolvedValueOnce(createMockResponse({}, 404) as any)
        .mockResolvedValueOnce(createMockResponse(validConfig, 200) as any);

      const result = await OAuthDiscovery.discover('https://example.com');

      expect(result).toEqual(validConfig);
      expect(axiosWithoutSse).toHaveBeenCalledTimes(3);
    });

    it('should return null when no valid config found', async () => {
      vi.mocked(axiosWithoutSse).mockResolvedValue(
        createMockResponse({}, 404) as any
      );

      const result = await OAuthDiscovery.discover('https://example.com');

      expect(result).toBeNull();
    });

    it('should validate OAuth config has required fields', async () => {
      const invalidConfig = {
        issuer: 'https://example.com'
        // missing required authorization_endpoint and token_endpoint
      };

      vi.mocked(axiosWithoutSse).mockResolvedValueOnce(
        createMockResponse(invalidConfig, 200) as any
      );

      const result = await OAuthDiscovery.discover('https://example.com');

      expect(result).toBeNull();
    });

    it('should handle network errors gracefully', async () => {
      vi.mocked(axiosWithoutSse).mockRejectedValue(new Error('Network error'));

      const result = await OAuthDiscovery.discover('https://example.com');

      expect(result).toBeNull();
    });

    it('should handle timeout errors', async () => {
      vi.mocked(axiosWithoutSse).mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout'
      });

      const result = await OAuthDiscovery.discover('https://example.com');

      expect(result).toBeNull();
    });

    it('should discover from direct URL if it contains valid config', async () => {
      vi.mocked(axiosWithoutSse).mockResolvedValueOnce(
        createMockResponse(validConfig, 200) as any
      );

      const result = await OAuthDiscovery.discover(
        'https://example.com/.well-known/openid-configuration'
      );

      expect(result).toEqual(validConfig);
    });

    it('should handle URLs with paths', async () => {
      vi.mocked(axiosWithoutSse)
        .mockResolvedValueOnce(createMockResponse({}, 404) as any)
        .mockResolvedValueOnce(createMockResponse(validConfig, 200) as any);

      const result = await OAuthDiscovery.discover('https://example.com/oauth');

      expect(result).toEqual(validConfig);
    });

    it('should validate config has string endpoints', async () => {
      const configWithNumberEndpoint = {
        issuer: 'https://example.com',
        authorization_endpoint: 12345, // invalid type
        token_endpoint: 'https://example.com/token'
      };

      vi.mocked(axiosWithoutSse).mockResolvedValueOnce(
        createMockResponse(configWithNumberEndpoint, 200) as any
      );

      const result = await OAuthDiscovery.discover('https://example.com');

      expect(result).toBeNull();
    });

    it('should accept config without issuer', async () => {
      const configWithoutIssuer = {
        authorization_endpoint: 'https://example.com/oauth/authorize',
        token_endpoint: 'https://example.com/oauth/token'
      };

      vi.mocked(axiosWithoutSse).mockResolvedValueOnce(
        createMockResponse(configWithoutIssuer, 200) as any
      );

      const result = await OAuthDiscovery.discover('https://example.com');

      expect(result).toEqual(configWithoutIssuer);
    });

    it('should handle WWW-Authenticate discovery', async () => {
      const authServerConfig: OAuthConfiguration = {
        issuer: 'https://auth.example.com',
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token'
      };

      // First request returns 401 with WWW-Authenticate header
      vi.mocked(axiosWithoutSse)
        .mockResolvedValueOnce(createMockResponse({}, 404) as any)
        .mockResolvedValueOnce(createMockResponse({}, 401, {
          'www-authenticate': 'Bearer authorization_servers="[\\"https://auth.example.com\\"]"'
        }) as any)
        .mockResolvedValueOnce(createMockResponse(authServerConfig, 200) as any);

      const result = await OAuthDiscovery.discover('https://example.com');

      expect(result).toEqual(authServerConfig);
    });

    it('should handle malformed WWW-Authenticate header', async () => {
      vi.mocked(axiosWithoutSse)
        .mockResolvedValueOnce(createMockResponse({}, 404) as any)
        .mockResolvedValueOnce(createMockResponse({}, 401, {
          'www-authenticate': 'Bearer malformed'
        }) as any);

      const result = await OAuthDiscovery.discover('https://example.com');

      expect(result).toBeNull();
    });

    it('should handle discovery URL with query parameters', async () => {
      vi.mocked(axiosWithoutSse).mockResolvedValueOnce(
        createMockResponse(validConfig, 200) as any
      );

      const result = await OAuthDiscovery.discover('https://example.com?param=value');

      // Query params should be preserved or handled appropriately
      expect(axiosWithoutSse).toHaveBeenCalled();
    });

    it('should handle response with extra fields', async () => {
      const configWithExtras = {
        ...validConfig,
        extra_field: 'extra_value',
        custom_property: 123
      };

      vi.mocked(axiosWithoutSse).mockResolvedValueOnce(
        createMockResponse(configWithExtras, 200) as any
      );

      const result = await OAuthDiscovery.discover('https://example.com');

      expect(result).toBeDefined();
      expect(result?.authorization_endpoint).toBe(validConfig.authorization_endpoint);
    });
  });

  describe('edge cases', () => {
    it('should handle empty response data', async () => {
      vi.mocked(axiosWithoutSse).mockResolvedValueOnce(
        createMockResponse(null, 200) as any
      );

      const result = await OAuthDiscovery.discover('https://example.com');

      expect(result).toBeNull();
    });

    it('should handle non-object response data', async () => {
      vi.mocked(axiosWithoutSse).mockResolvedValueOnce(
        createMockResponse('not an object' as any, 200) as any
      );

      const result = await OAuthDiscovery.discover('https://example.com');

      expect(result).toBeNull();
    });

    it('should handle array response data', async () => {
      vi.mocked(axiosWithoutSse).mockResolvedValueOnce(
        createMockResponse([] as any, 200) as any
      );

      const result = await OAuthDiscovery.discover('https://example.com');

      expect(result).toBeNull();
    });

    it('should handle URLs with special characters', async () => {
      vi.mocked(axiosWithoutSse).mockResolvedValueOnce(
        createMockResponse({
          authorization_endpoint: 'https://example.com/oauth/authorize',
          token_endpoint: 'https://example.com/oauth/token'
        }, 200) as any
      );

      const result = await OAuthDiscovery.discover('https://example.com/path%20with%20spaces');

      expect(axiosWithoutSse).toHaveBeenCalled();
    });
  });
});
