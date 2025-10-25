// @ts-nocheck - Test file with mocked types
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceError } from '@metorial/error';

// Mock external dependencies
vi.mock('@metorial/config', () => ({
  getFullConfig: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    scmInstallationAttempt: {
      create: vi.fn(),
      findUnique: vi.fn()
    },
    scmInstallation: {
      upsert: vi.fn(),
      findFirst: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn()
  }
}));

vi.mock('@metorial/id', () => ({
  generatePlainId: vi.fn()
}));

vi.mock('../src/env', () => ({
  env: {
    gh: {
      SCM_GITHUB_CLIENT_ID: 'test-client-id',
      SCM_GITHUB_CLIENT_SECRET: 'test-client-secret'
    }
  }
}));

// Mock global fetch
global.fetch = vi.fn();

import { scmAuthService } from '../src/services/scmAuth';
import { db, ID } from '@metorial/db';
import { getFullConfig } from '@metorial/config';
import { generatePlainId } from '@metorial/id';

describe('scmAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAuthorizationUrl', () => {
    it('should generate GitHub authorization URL', async () => {
      const mockOrganization = { oid: 'org-oid-1', id: 'org-1' } as any;
      const mockActor = { oid: 'actor-oid-1', id: 'actor-1' } as any;
      const mockState = 'random-state-123';

      vi.mocked(generatePlainId).mockReturnValue(mockState);
      vi.mocked(db.scmInstallationAttempt.create).mockResolvedValue({
        state: mockState,
        redirectUrl: 'https://example.com/callback'
      } as any);
      vi.mocked(getFullConfig).mockResolvedValue({
        urls: { integrationsApiUrl: 'https://integrations.example.com' }
      } as any);

      const result = await scmAuthService.getAuthorizationUrl({
        organization: mockOrganization,
        organizationActor: mockActor,
        provider: 'github',
        redirectUrl: 'https://example.com/callback'
      });

      expect(db.scmInstallationAttempt.create).toHaveBeenCalledWith({
        data: {
          redirectUrl: 'https://example.com/callback',
          state: mockState,
          organizationOid: mockOrganization.oid,
          ownerActorOid: mockActor.oid
        }
      });

      expect(result).toContain('https://github.com/login/oauth/authorize');
      expect(result).toContain(`client_id=test-client-id`);
      expect(result).toContain(`state=${mockState}`);
      expect(result).toContain('scope=user%3Aemail+read%3Aorg+repo');
    });

    it('should throw error for unsupported provider', async () => {
      const mockOrganization = { oid: 'org-oid-1' } as any;
      const mockActor = { oid: 'actor-oid-1' } as any;

      vi.mocked(generatePlainId).mockReturnValue('state-123');
      vi.mocked(db.scmInstallationAttempt.create).mockResolvedValue({} as any);
      vi.mocked(getFullConfig).mockResolvedValue({
        urls: { integrationsApiUrl: 'https://integrations.example.com' }
      } as any);

      await expect(
        scmAuthService.getAuthorizationUrl({
          organization: mockOrganization,
          organizationActor: mockActor,
          provider: 'gitlab' as any,
          redirectUrl: 'https://example.com/callback'
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should successfully exchange code for token', async () => {
      const mockAttempt = {
        state: 'valid-state',
        organizationOid: 'org-oid-1',
        ownerActorOid: 'actor-oid-1'
      };

      const mockTokenResponse = {
        access_token: 'github-access-token'
      };

      const mockProfileResponse = {
        id: 12345,
        login: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://avatar.url'
      };

      vi.mocked(db.scmInstallationAttempt.findUnique).mockResolvedValue(mockAttempt as any);
      vi.mocked(getFullConfig).mockResolvedValue({
        urls: { integrationsApiUrl: 'https://integrations.example.com' }
      } as any);
      vi.mocked(ID.generateId).mockResolvedValue('scm-inst-123');

      // Mock fetch for token exchange
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse
      } as any);

      // Mock fetch for profile
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfileResponse
      } as any);

      vi.mocked(db.scmInstallation.upsert).mockResolvedValue({
        id: 'scm-inst-123',
        ...mockAttempt,
        externalUserId: '12345'
      } as any);

      const result = await scmAuthService.exchangeCodeForToken({
        provider: 'github',
        code: 'auth-code',
        state: 'valid-state'
      });

      expect(db.scmInstallationAttempt.findUnique).toHaveBeenCalledWith({
        where: { state: 'valid-state' }
      });

      expect(db.scmInstallation.upsert).toHaveBeenCalledWith({
        where: {
          organizationOid_provider_externalUserId: {
            organizationOid: mockAttempt.organizationOid,
            provider: 'github',
            externalUserId: '12345'
          }
        },
        update: expect.objectContaining({
          provider: 'github',
          externalUserId: '12345',
          externalUserName: 'Test User',
          externalUserEmail: 'test@example.com',
          accessToken: 'github-access-token'
        }),
        create: expect.objectContaining({
          id: 'scm-inst-123',
          provider: 'github',
          externalUserId: '12345'
        })
      });

      expect(result.id).toBe('scm-inst-123');
    });

    it('should throw error for invalid state', async () => {
      vi.mocked(db.scmInstallationAttempt.findUnique).mockResolvedValue(null);

      await expect(
        scmAuthService.exchangeCodeForToken({
          provider: 'github',
          code: 'auth-code',
          state: 'invalid-state'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw error when token exchange fails', async () => {
      const mockAttempt = {
        state: 'valid-state',
        organizationOid: 'org-oid-1',
        ownerActorOid: 'actor-oid-1'
      };

      vi.mocked(db.scmInstallationAttempt.findUnique).mockResolvedValue(mockAttempt as any);
      vi.mocked(getFullConfig).mockResolvedValue({
        urls: { integrationsApiUrl: 'https://integrations.example.com' }
      } as any);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400
      } as any);

      await expect(
        scmAuthService.exchangeCodeForToken({
          provider: 'github',
          code: 'invalid-code',
          state: 'valid-state'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw error when token response contains error', async () => {
      const mockAttempt = {
        state: 'valid-state',
        organizationOid: 'org-oid-1',
        ownerActorOid: 'actor-oid-1'
      };

      vi.mocked(db.scmInstallationAttempt.findUnique).mockResolvedValue(mockAttempt as any);
      vi.mocked(getFullConfig).mockResolvedValue({
        urls: { integrationsApiUrl: 'https://integrations.example.com' }
      } as any);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'The code has expired'
        })
      } as any);

      await expect(
        scmAuthService.exchangeCodeForToken({
          provider: 'github',
          code: 'expired-code',
          state: 'valid-state'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw error when profile fetch fails', async () => {
      const mockAttempt = {
        state: 'valid-state',
        organizationOid: 'org-oid-1',
        ownerActorOid: 'actor-oid-1'
      };

      const mockTokenResponse = {
        access_token: 'github-access-token'
      };

      vi.mocked(db.scmInstallationAttempt.findUnique).mockResolvedValue(mockAttempt as any);
      vi.mocked(getFullConfig).mockResolvedValue({
        urls: { integrationsApiUrl: 'https://integrations.example.com' }
      } as any);

      // Mock successful token exchange
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse
      } as any);

      // Mock failed profile fetch
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401
      } as any);

      await expect(
        scmAuthService.exchangeCodeForToken({
          provider: 'github',
          code: 'auth-code',
          state: 'valid-state'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw error when profile data is invalid', async () => {
      const mockAttempt = {
        state: 'valid-state',
        organizationOid: 'org-oid-1',
        ownerActorOid: 'actor-oid-1'
      };

      const mockTokenResponse = {
        access_token: 'github-access-token'
      };

      vi.mocked(db.scmInstallationAttempt.findUnique).mockResolvedValue(mockAttempt as any);
      vi.mocked(getFullConfig).mockResolvedValue({
        urls: { integrationsApiUrl: 'https://integrations.example.com' }
      } as any);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse
      } as any);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}) // Missing required fields
      } as any);

      await expect(
        scmAuthService.exchangeCodeForToken({
          provider: 'github',
          code: 'auth-code',
          state: 'valid-state'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should handle profile without email', async () => {
      const mockAttempt = {
        state: 'valid-state',
        organizationOid: 'org-oid-1',
        ownerActorOid: 'actor-oid-1'
      };

      const mockProfileResponse = {
        id: 12345,
        login: 'testuser',
        name: 'Test User'
        // No email
      };

      vi.mocked(db.scmInstallationAttempt.findUnique).mockResolvedValue(mockAttempt as any);
      vi.mocked(getFullConfig).mockResolvedValue({
        urls: { integrationsApiUrl: 'https://integrations.example.com' }
      } as any);
      vi.mocked(ID.generateId).mockResolvedValue('scm-inst-123');

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token' })
      } as any);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfileResponse
      } as any);

      vi.mocked(db.scmInstallation.upsert).mockResolvedValue({
        id: 'scm-inst-123'
      } as any);

      const result = await scmAuthService.exchangeCodeForToken({
        provider: 'github',
        code: 'auth-code',
        state: 'valid-state'
      });

      expect(result).toBeDefined();
    });

    it('should use login as name when name is not provided', async () => {
      const mockAttempt = {
        state: 'valid-state',
        organizationOid: 'org-oid-1',
        ownerActorOid: 'actor-oid-1'
      };

      const mockProfileResponse = {
        id: 12345,
        login: 'testuser'
        // No name field
      };

      vi.mocked(db.scmInstallationAttempt.findUnique).mockResolvedValue(mockAttempt as any);
      vi.mocked(getFullConfig).mockResolvedValue({
        urls: { integrationsApiUrl: 'https://integrations.example.com' }
      } as any);
      vi.mocked(ID.generateId).mockResolvedValue('scm-inst-123');

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token' })
      } as any);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfileResponse
      } as any);

      vi.mocked(db.scmInstallation.upsert).mockResolvedValue({
        id: 'scm-inst-123'
      } as any);

      await scmAuthService.exchangeCodeForToken({
        provider: 'github',
        code: 'auth-code',
        state: 'valid-state'
      });

      expect(db.scmInstallation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            externalUserName: 'testuser'
          })
        })
      );
    });
  });

  describe('getMatchingInstallation', () => {
    it('should return installation for matching owner actor', async () => {
      const mockOrganization = { oid: 'org-oid-1', id: 'org-1' } as any;
      const mockActor = { oid: 'actor-oid-1', id: 'actor-1' } as any;
      const mockInstallation = {
        id: 'inst-1',
        organizationOid: 'org-oid-1',
        provider: 'github',
        ownerActorOid: 'actor-oid-1'
      };

      vi.mocked(db.scmInstallation.findFirst).mockResolvedValueOnce(mockInstallation as any);

      const result = await scmAuthService.getMatchingInstallation({
        organization: mockOrganization,
        provider: 'github',
        ownerActor: mockActor
      });

      expect(result).toEqual(mockInstallation);
      expect(db.scmInstallation.findFirst).toHaveBeenCalledWith({
        where: {
          organizationOid: mockOrganization.oid,
          provider: 'github',
          ownerActorOid: mockActor.oid
        }
      });
    });

    it('should return any installation if no exact match', async () => {
      const mockOrganization = { oid: 'org-oid-1', id: 'org-1' } as any;
      const mockActor = { oid: 'actor-oid-1', id: 'actor-1' } as any;
      const mockInstallation = {
        id: 'inst-2',
        organizationOid: 'org-oid-1',
        provider: 'github',
        ownerActorOid: 'actor-oid-2'
      };

      // First call returns null (no exact match)
      vi.mocked(db.scmInstallation.findFirst).mockResolvedValueOnce(null);
      // Second call returns any installation
      vi.mocked(db.scmInstallation.findFirst).mockResolvedValueOnce(mockInstallation as any);

      const result = await scmAuthService.getMatchingInstallation({
        organization: mockOrganization,
        provider: 'github',
        ownerActor: mockActor
      });

      expect(result).toEqual(mockInstallation);
      expect(db.scmInstallation.findFirst).toHaveBeenCalledTimes(2);
    });

    it('should throw error if no installation found', async () => {
      const mockOrganization = { oid: 'org-oid-1', id: 'org-1' } as any;
      const mockActor = { oid: 'actor-oid-1', id: 'actor-1' } as any;

      vi.mocked(db.scmInstallation.findFirst).mockResolvedValueOnce(null);
      vi.mocked(db.scmInstallation.findFirst).mockResolvedValueOnce(null);

      await expect(
        scmAuthService.getMatchingInstallation({
          organization: mockOrganization,
          provider: 'github',
          ownerActor: mockActor
        })
      ).rejects.toThrow(ServiceError);
    });
  });
});
