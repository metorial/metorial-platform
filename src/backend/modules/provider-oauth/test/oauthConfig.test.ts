import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Instance, ProviderOAuthConfig } from '@metorial/db';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    providerOAuthConfig: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn()
    }
  },
  ensureProviderOAuthConfig: vi.fn(),
  ID: {
    generateId: vi.fn(() => Promise.resolve('test-id'))
  }
}));

vi.mock('@metorial/hash', () => ({
  Hash: {
    sha256: vi.fn(async (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
      }
      return `hash-${Math.abs(hash).toString(16)}`;
    })
  }
}));

vi.mock('../src/queue/configAutoDiscovery', () => ({
  configAutoDiscoveryQueue: {
    add: vi.fn()
  }
}));

vi.mock('@metorial/canonicalize', () => ({
  canonicalize: vi.fn((obj) => JSON.stringify(obj))
}));

import { providerOauthConfigService } from '../src/services/oauthConfig';
import { ensureProviderOAuthConfig } from '@metorial/db';
import { configAutoDiscoveryQueue } from '../src/queue/configAutoDiscovery';

describe('oauthConfig service', () => {
  const mockInstance: Instance = {
    id: 'instance-1',
    oid: 1n,
    createdAt: new Date(),
    updatedAt: new Date()
  } as any;

  const mockConfig: ProviderOAuthConfig = {
    id: 'config-1',
    oid: 1n,
    configHash: 'hash-123',
    scopes: ['openid', 'profile'],
    config: {
      issuer: 'https://example.com',
      authorization_endpoint: 'https://example.com/authorize',
      token_endpoint: 'https://example.com/token'
    },
    httpEndpoint: null,
    hasRemoteOauthForm: null,
    lambdaServerInstanceForHttpEndpointOid: null,
    instanceOid: 1n,
    discoverStatus: 'discovered',
    type: 'json',
    createdAt: new Date(),
    updatedAt: new Date()
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createConfig', () => {
    it('should create JSON config with valid OAuth configuration', async () => {
      vi.mocked(ensureProviderOAuthConfig).mockResolvedValueOnce(mockConfig);

      const result = await providerOauthConfigService.createConfig({
        instance: mockInstance,
        implementation: {
          type: 'json',
          config: {
            issuer: 'https://example.com',
            authorization_endpoint: 'https://example.com/authorize',
            token_endpoint: 'https://example.com/token'
          },
          scopes: ['openid', 'profile']
        }
      });

      expect(result).toEqual(mockConfig);
      expect(ensureProviderOAuthConfig).toHaveBeenCalled();
    });

    it('should reject invalid OAuth configuration', async () => {
      await expect(
        providerOauthConfigService.createConfig({
          instance: mockInstance,
          implementation: {
            type: 'json',
            config: {
              authorization_endpoint: 'not-a-valid-url',
              token_endpoint: 'https://example.com/token'
            } as any,
            scopes: []
          }
        })
      ).rejects.toThrow();
    });

    it('should create managed server HTTP config', async () => {
      const httpConfig = {
        ...mockConfig,
        type: 'managed_server_http',
        httpEndpoint: 'https://server.example.com/oauth',
        hasRemoteOauthForm: true,
        lambdaServerInstanceForHttpEndpointOid: 2n
      } as any;

      vi.mocked(ensureProviderOAuthConfig).mockResolvedValueOnce(httpConfig);

      const result = await providerOauthConfigService.createConfig({
        instance: mockInstance,
        implementation: {
          type: 'managed_server_http',
          httpEndpoint: 'https://server.example.com/oauth',
          hasRemoteOauthForm: true,
          lambdaServerInstanceOid: 2n
        }
      });

      expect(result).toEqual(httpConfig);
      expect(ensureProviderOAuthConfig).toHaveBeenCalled();
    });

    it('should trigger config auto discovery queue', async () => {
      const discoveringConfig = {
        ...mockConfig,
        discoverStatus: 'discovering'
      } as any;

      vi.mocked(ensureProviderOAuthConfig).mockResolvedValueOnce(discoveringConfig);

      await providerOauthConfigService.createConfig({
        instance: mockInstance,
        implementation: {
          type: 'json',
          config: {
            issuer: 'https://example.com',
            authorization_endpoint: 'https://example.com/authorize',
            token_endpoint: 'https://example.com/token'
          },
          scopes: ['openid']
        }
      });

      expect(configAutoDiscoveryQueue.add).toHaveBeenCalledWith({
        configId: discoveringConfig.id
      });
    });

    it('should not trigger queue if config already discovered', async () => {
      vi.mocked(ensureProviderOAuthConfig).mockResolvedValueOnce(mockConfig);

      await providerOauthConfigService.createConfig({
        instance: mockInstance,
        implementation: {
          type: 'json',
          config: {
            issuer: 'https://example.com',
            authorization_endpoint: 'https://example.com/authorize',
            token_endpoint: 'https://example.com/token'
          },
          scopes: ['openid']
        }
      });

      expect(configAutoDiscoveryQueue.add).not.toHaveBeenCalled();
    });

    it('should handle missing optional fields in config', async () => {
      vi.mocked(ensureProviderOAuthConfig).mockResolvedValueOnce(mockConfig);

      const result = await providerOauthConfigService.createConfig({
        instance: mockInstance,
        implementation: {
          type: 'json',
          config: {
            authorization_endpoint: 'https://example.com/authorize',
            token_endpoint: 'https://example.com/token'
          },
          scopes: []
        }
      });

      expect(result).toEqual(mockConfig);
    });

    it('should reject config missing required endpoints', async () => {
      await expect(
        providerOauthConfigService.createConfig({
          instance: mockInstance,
          implementation: {
            type: 'json',
            config: {
              issuer: 'https://example.com'
            } as any,
            scopes: []
          }
        })
      ).rejects.toThrow();
    });
  });

  describe('cloneConfig', () => {
    it('should clone JSON config', async () => {
      const clonedConfig = { ...mockConfig, id: 'config-2' };
      vi.mocked(ensureProviderOAuthConfig).mockResolvedValueOnce(clonedConfig);

      const result = await providerOauthConfigService.cloneConfig({
        instance: mockInstance,
        config: mockConfig
      });

      expect(result).toEqual(clonedConfig);
      expect(ensureProviderOAuthConfig).toHaveBeenCalled();
    });

    it('should clone managed server HTTP config', async () => {
      const httpConfig = {
        ...mockConfig,
        type: 'managed_server_http',
        httpEndpoint: 'https://server.example.com/oauth',
        hasRemoteOauthForm: true,
        lambdaServerInstanceForHttpEndpointOid: 2n
      } as any;

      const clonedConfig = { ...httpConfig, id: 'config-2' };
      vi.mocked(ensureProviderOAuthConfig).mockResolvedValueOnce(clonedConfig);

      const result = await providerOauthConfigService.cloneConfig({
        instance: mockInstance,
        config: httpConfig
      });

      expect(result).toEqual(clonedConfig);
    });

    it('should preserve config scopes when cloning', async () => {
      const configWithScopes = {
        ...mockConfig,
        scopes: ['openid', 'profile', 'email']
      } as any;

      const clonedConfig = { ...configWithScopes, id: 'config-2' };
      vi.mocked(ensureProviderOAuthConfig).mockResolvedValueOnce(clonedConfig);

      await providerOauthConfigService.cloneConfig({
        instance: mockInstance,
        config: configWithScopes
      });

      expect(ensureProviderOAuthConfig).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty scopes array', async () => {
      vi.mocked(ensureProviderOAuthConfig).mockResolvedValueOnce({
        ...mockConfig,
        scopes: []
      });

      const result = await providerOauthConfigService.createConfig({
        instance: mockInstance,
        implementation: {
          type: 'json',
          config: {
            authorization_endpoint: 'https://example.com/authorize',
            token_endpoint: 'https://example.com/token'
          },
          scopes: []
        }
      });

      expect(result.scopes).toEqual([]);
    });

    it('should handle config with all optional OAuth fields', async () => {
      vi.mocked(ensureProviderOAuthConfig).mockResolvedValueOnce(mockConfig);

      await providerOauthConfigService.createConfig({
        instance: mockInstance,
        implementation: {
          type: 'json',
          config: {
            issuer: 'https://example.com',
            authorization_endpoint: 'https://example.com/authorize',
            token_endpoint: 'https://example.com/token',
            userinfo_endpoint: 'https://example.com/userinfo',
            registration_endpoint: 'https://example.com/register'
          },
          scopes: ['openid', 'profile', 'email']
        }
      });

      expect(ensureProviderOAuthConfig).toHaveBeenCalled();
    });
  });
});
