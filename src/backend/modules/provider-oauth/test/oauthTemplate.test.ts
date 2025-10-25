import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ProviderOAuthConnectionTemplate, Profile } from '@metorial/db';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    providerOAuthConnectionTemplate: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    profile: {
      findMany: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn(() => Promise.resolve('template-id'))
  },
  systemProfile: Promise.resolve({ oid: 1n, id: 'system-profile' })
}));

vi.mock('@metorial/pagination', () => ({
  Paginator: {
    create: vi.fn((fn) => {
      return {
        paginate: async () => {
          const result = await fn({ prisma: (cb: any) => cb({}) });
          return { items: result, hasMore: false };
        }
      };
    })
  }
}));

vi.mock('jsonata', () => ({
  default: vi.fn((expr) => ({
    evaluate: vi.fn((data) => {
      // Simple mock evaluation - just return parsed JSON if expr is valid JSON
      try {
        return JSON.parse(expr);
      } catch {
        return { mocked: true, ...data };
      }
    })
  }))
}));

import { providerOauthTemplateService } from '../src/services/oauthTemplate';
import { db } from '@metorial/db';

describe('oauthTemplate service', () => {
  const mockTemplate: ProviderOAuthConnectionTemplate = {
    id: 'template-1',
    oid: 1n,
    slug: 'github',
    name: 'GitHub',
    providerName: 'GitHub',
    providerUrl: 'https://github.com',
    image: { type: 'url', url: 'https://example.com/github.png' },
    discoveryUrl: undefined,
    configJsonata: JSON.stringify({
      issuer: 'https://github.com',
      authorization_endpoint: 'https://github.com/login/oauth/authorize',
      token_endpoint: 'https://github.com/login/oauth/access_token'
    }),
    scopes: [
      { identifier: 'repo', description: 'Access repositories' },
      { identifier: 'user', description: 'Access user data' }
    ],
    variables: [],
    profileOid: 1n,
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: {
      id: 'system-profile',
      oid: 1n
    } as Profile
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureTemplate', () => {
    it('should create new template', async () => {
      vi.mocked(db.providerOAuthConnectionTemplate.upsert).mockResolvedValueOnce(mockTemplate);

      const result = await providerOauthTemplateService.ensureTemplate({
        slug: 'github',
        name: 'GitHub',
        providerName: 'GitHub',
        providerUrl: 'https://github.com',
        imageUrl: 'https://example.com/github.png',
        configJsonata: JSON.stringify({
          issuer: 'https://github.com',
          authorization_endpoint: 'https://github.com/login/oauth/authorize',
          token_endpoint: 'https://github.com/login/oauth/access_token'
        }),
        scopes: [
          { identifier: 'repo', description: 'Access repositories' }
        ],
        variables: []
      });

      expect(result).toEqual(mockTemplate);
      expect(db.providerOAuthConnectionTemplate.upsert).toHaveBeenCalled();
    });

    it('should update existing template with same slug', async () => {
      vi.mocked(db.providerOAuthConnectionTemplate.upsert).mockResolvedValueOnce(mockTemplate);

      await providerOauthTemplateService.ensureTemplate({
        slug: 'github',
        name: 'GitHub Updated',
        providerName: 'GitHub',
        providerUrl: 'https://github.com',
        imageUrl: 'https://example.com/github-new.png',
        configJsonata: JSON.stringify({}),
        scopes: [],
        variables: []
      });

      expect(db.providerOAuthConnectionTemplate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'github' }
        })
      );
    });

    it('should handle template with discovery URL', async () => {
      const templateWithDiscovery = {
        ...mockTemplate,
        discoveryUrl: 'https://github.com/.well-known/openid-configuration'
      };

      vi.mocked(db.providerOAuthConnectionTemplate.upsert).mockResolvedValueOnce(
        templateWithDiscovery
      );

      const result = await providerOauthTemplateService.ensureTemplate({
        slug: 'github',
        name: 'GitHub',
        providerName: 'GitHub',
        providerUrl: 'https://github.com',
        imageUrl: 'https://example.com/github.png',
        discoveryUrl: 'https://github.com/.well-known/openid-configuration',
        configJsonata: JSON.stringify({}),
        scopes: [],
        variables: []
      });

      expect(result.discoveryUrl).toBe('https://github.com/.well-known/openid-configuration');
    });

    it('should handle template with variables', async () => {
      const templateWithVariables = {
        ...mockTemplate,
        variables: [
          { type: 'string' as const, key: 'domain', label: 'Domain', isRequired: true }
        ]
      } as any;

      vi.mocked(db.providerOAuthConnectionTemplate.upsert).mockResolvedValueOnce(
        templateWithVariables
      );

      const result = await providerOauthTemplateService.ensureTemplate({
        slug: 'custom',
        name: 'Custom OAuth',
        providerName: 'Custom',
        providerUrl: 'https://custom.com',
        imageUrl: 'https://example.com/custom.png',
        configJsonata: JSON.stringify({}),
        scopes: [],
        variables: [
          { type: 'string', key: 'domain', label: 'Domain', isRequired: true }
        ]
      });

      expect(result.variables).toHaveLength(1);
    });

    it('should handle template with multiple scopes', async () => {
      const templateWithScopes = {
        ...mockTemplate,
        scopes: [
          { identifier: 'openid', description: 'OpenID Connect' },
          { identifier: 'profile', description: 'User profile' },
          { identifier: 'email', description: 'Email address' }
        ]
      };

      vi.mocked(db.providerOAuthConnectionTemplate.upsert).mockResolvedValueOnce(
        templateWithScopes
      );

      const result = await providerOauthTemplateService.ensureTemplate({
        slug: 'oidc',
        name: 'OIDC Provider',
        providerName: 'OIDC',
        providerUrl: 'https://oidc.example.com',
        imageUrl: 'https://example.com/oidc.png',
        configJsonata: JSON.stringify({}),
        scopes: [
          { identifier: 'openid', description: 'OpenID Connect' },
          { identifier: 'profile', description: 'User profile' },
          { identifier: 'email', description: 'Email address' }
        ],
        variables: []
      });

      expect(result.scopes).toHaveLength(3);
    });
  });

  describe('getTemplateById', () => {
    it('should return template by ID', async () => {
      vi.mocked(db.providerOAuthConnectionTemplate.findUnique).mockResolvedValueOnce(mockTemplate);

      const result = await providerOauthTemplateService.getTemplateById({
        templateId: 'template-1'
      });

      expect(result).toEqual(mockTemplate);
      expect(db.providerOAuthConnectionTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        include: { profile: true }
      });
    });

    it('should throw error if template not found', async () => {
      vi.mocked(db.providerOAuthConnectionTemplate.findUnique).mockResolvedValueOnce(null);

      await expect(
        providerOauthTemplateService.getTemplateById({
          templateId: 'nonexistent'
        })
      ).rejects.toThrow();
    });
  });

  describe('listTemplates', () => {
    it('should list all templates when no profile IDs provided', async () => {
      vi.mocked(db.providerOAuthConnectionTemplate.findMany).mockResolvedValueOnce([mockTemplate]);

      const paginator = await providerOauthTemplateService.listTemplates({});
      // Paginator returns an object, test that it's created
      expect(paginator).toBeDefined();
    });

    it('should filter templates by profile IDs', async () => {
      vi.mocked(db.profile.findMany).mockResolvedValueOnce([
        { oid: 1n, id: 'profile-1' } as any,
        { oid: 2n, id: 'profile-2' } as any
      ]);
      vi.mocked(db.providerOAuthConnectionTemplate.findMany).mockResolvedValueOnce([mockTemplate]);

      const paginator = await providerOauthTemplateService.listTemplates({
        profileIds: ['profile-1', 'profile-2']
      });

      expect(db.profile.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['profile-1', 'profile-2'] } },
        select: { oid: true }
      });
      expect(paginator).toBeDefined();
    });

    it('should return empty list when no templates match', async () => {
      vi.mocked(db.providerOAuthConnectionTemplate.findMany).mockResolvedValueOnce([]);

      const paginator = await providerOauthTemplateService.listTemplates({});
      expect(paginator).toBeDefined();
    });
  });

  describe('evaluateTemplateConfig', () => {
    it('should evaluate template config with no variables', async () => {
      const config = await providerOauthTemplateService.evaluateTemplateConfig({
        template: mockTemplate,
        data: {}
      });

      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    it('should evaluate template config with provided variables', async () => {
      const templateWithVariables = {
        ...mockTemplate,
        variables: [
          { type: 'string' as const, key: 'domain', label: 'Domain', isRequired: false }
        ],
        configJsonata: JSON.stringify({ domain: 'example.com' })
      } as any;

      const config = await providerOauthTemplateService.evaluateTemplateConfig({
        template: templateWithVariables,
        data: { domain: 'custom.com' }
      });

      expect(config).toBeDefined();
    });

    it('should throw error if required variable is missing', async () => {
      const templateWithRequiredVar = {
        ...mockTemplate,
        variables: [
          { type: 'string' as const, key: 'domain', label: 'Domain', isRequired: true }
        ]
      } as any;

      await expect(
        providerOauthTemplateService.evaluateTemplateConfig({
          template: templateWithRequiredVar,
          data: {}
        })
      ).rejects.toThrow('Missing required variable: domain');
    });

    it('should throw error if config evaluation returns non-object', async () => {
      const templateWithInvalidJsonata = {
        ...mockTemplate,
        configJsonata: '"string result"'
      } as any;

      await expect(
        providerOauthTemplateService.evaluateTemplateConfig({
          template: templateWithInvalidJsonata,
          data: {}
        })
      ).rejects.toThrow('Invalid config returned from template evaluation');
    });

    it('should handle multiple variables', async () => {
      const templateWithMultipleVars = {
        ...mockTemplate,
        variables: [
          { type: 'string' as const, key: 'domain', label: 'Domain', isRequired: true },
          { type: 'string' as const, key: 'clientId', label: 'Client ID', isRequired: true },
          { type: 'string' as const, key: 'region', label: 'Region', isRequired: false }
        ],
        configJsonata: JSON.stringify({ test: true })
      } as any;

      const config = await providerOauthTemplateService.evaluateTemplateConfig({
        template: templateWithMultipleVars,
        data: {
          domain: 'example.com',
          clientId: 'client-123',
          region: 'us-east-1'
        }
      });

      expect(config).toBeDefined();
    });

    it('should allow optional variables to be omitted', async () => {
      const templateWithOptionalVar = {
        ...mockTemplate,
        variables: [
          { type: 'string' as const, key: 'optional', label: 'Optional', isRequired: false }
        ],
        configJsonata: JSON.stringify({ test: true })
      } as any;

      const config = await providerOauthTemplateService.evaluateTemplateConfig({
        template: templateWithOptionalVar,
        data: {}
      });

      expect(config).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle template with empty scopes array', async () => {
      const templateWithoutScopes = {
        ...mockTemplate,
        scopes: []
      };

      vi.mocked(db.providerOAuthConnectionTemplate.upsert).mockResolvedValueOnce(
        templateWithoutScopes
      );

      const result = await providerOauthTemplateService.ensureTemplate({
        slug: 'minimal',
        name: 'Minimal',
        providerName: 'Minimal',
        providerUrl: 'https://minimal.com',
        imageUrl: 'https://example.com/minimal.png',
        configJsonata: JSON.stringify({}),
        scopes: [],
        variables: []
      });

      expect(result.scopes).toEqual([]);
    });

    it('should handle template with empty variables array', async () => {
      vi.mocked(db.providerOAuthConnectionTemplate.upsert).mockResolvedValueOnce(mockTemplate);

      const result = await providerOauthTemplateService.ensureTemplate({
        slug: 'simple',
        name: 'Simple',
        providerName: 'Simple',
        providerUrl: 'https://simple.com',
        imageUrl: 'https://example.com/simple.png',
        configJsonata: JSON.stringify({}),
        scopes: [],
        variables: []
      });

      expect(result.variables).toEqual([]);
    });
  });
});
