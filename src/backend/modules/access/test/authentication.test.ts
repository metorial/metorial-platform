import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Context } from '@metorial/context';
import { ServiceError, unauthorizedError } from '@metorial/error';
import { authenticationService } from '../src/services/authentication';
import { scopes, instancePublishableTokenScopes, instanceSecretTokenScopes, orgManagementTokenScopes } from '../src/definitions';

// Mock external dependencies
vi.mock('@metorial/module-user', () => ({
  userAuthService: {
    authenticateWithSessionSecret: vi.fn(),
    DANGEROUSLY_authenticateWithUserId: vi.fn()
  }
}));

vi.mock('@metorial/module-machine-access', () => ({
  machineAccessAuthService: {
    authenticateWithMachineAccessToken: vi.fn()
  }
}));

import { userAuthService } from '@metorial/module-user';
import { machineAccessAuthService } from '@metorial/module-machine-access';

describe('AuthenticationService', () => {
  let mockContext: Context;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {
      requestId: 'test-request-id',
      ip: '127.0.0.1'
    } as Context;
  });

  describe('authenticate', () => {
    it('should authenticate with user session when type is user_session', async () => {
      let mockUser = { id: 'user-1', email: 'test@example.com' };
      let mockSession = { id: 'session-1', userId: 'user-1' };

      vi.mocked(userAuthService.authenticateWithSessionSecret).mockResolvedValue({
        user: mockUser,
        session: mockSession
      } as any);

      let result = await authenticationService.authenticate({
        type: 'user_session',
        sessionClientSecret: 'secret-123',
        context: mockContext
      });

      expect(result).toEqual({
        type: 'user',
        user: mockUser,
        userSession: mockSession,
        orgScopes: scopes
      });

      expect(userAuthService.authenticateWithSessionSecret).toHaveBeenCalledWith({
        sessionClientSecret: 'secret-123',
        context: mockContext
      });
    });

    it('should authenticate with api key when type is api_key', async () => {
      let mockOrg = { id: 'org-1', slug: 'test-org' };
      let mockActor = { id: 'actor-1' };
      let mockMachineAccess = {
        type: 'organization_management',
        organization: mockOrg,
        actor: mockActor
      };
      let mockApiKey = { id: 'key-1', machineAccess: mockMachineAccess };

      vi.mocked(machineAccessAuthService.authenticateWithMachineAccessToken).mockResolvedValue({
        apiKey: mockApiKey
      } as any);

      let result = await authenticationService.authenticate({
        type: 'api_key',
        apiKey: 'pk_test_123',
        context: mockContext
      });

      expect(result.type).toBe('machine');
      expect(machineAccessAuthService.authenticateWithMachineAccessToken).toHaveBeenCalledWith({
        token: 'pk_test_123',
        context: mockContext
      });
    });

    it('should throw error for invalid authentication type', async () => {
      await expect(
        authenticationService.authenticate({
          type: 'invalid_type',
          context: mockContext
        } as any)
      ).rejects.toThrow('Invalid authentication type');
    });
  });

  describe('authenticateUserSession', () => {
    it('should return user auth info with all scopes', async () => {
      let mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test User' };
      let mockSession = { id: 'session-1', userId: 'user-1', createdAt: new Date() };

      vi.mocked(userAuthService.authenticateWithSessionSecret).mockResolvedValue({
        user: mockUser,
        session: mockSession
      } as any);

      let result = await authenticationService.authenticate({
        type: 'user_session',
        sessionClientSecret: 'valid-secret',
        context: mockContext
      });

      expect(result.type).toBe('user');
      if (result.type === 'user') {
        expect(result.user).toEqual(mockUser);
        expect(result.userSession).toEqual(mockSession);
        expect(result.orgScopes).toEqual(scopes);
        expect(result.orgScopes.length).toBeGreaterThan(0);
      }
    });

    it('should handle authentication failure', async () => {
      vi.mocked(userAuthService.authenticateWithSessionSecret).mockRejectedValue(
        new ServiceError(unauthorizedError({ message: 'Invalid session' }))
      );

      await expect(
        authenticationService.authenticate({
          type: 'user_session',
          sessionClientSecret: 'invalid-secret',
          context: mockContext
        })
      ).rejects.toThrow();
    });

    it('should pass context correctly', async () => {
      let customContext = { requestId: 'custom-id', userId: 'user-123' } as any;
      vi.mocked(userAuthService.authenticateWithSessionSecret).mockResolvedValue({
        user: { id: 'user-1' },
        session: { id: 'session-1' }
      } as any);

      await authenticationService.authenticate({
        type: 'user_session',
        sessionClientSecret: 'secret',
        context: customContext
      });

      expect(userAuthService.authenticateWithSessionSecret).toHaveBeenCalledWith({
        sessionClientSecret: 'secret',
        context: customContext
      });
    });
  });

  describe('DANGEROUSLY_authenticateWithUserId', () => {
    it('should authenticate user by ID without session', async () => {
      let mockUser = { id: 'user-1', email: 'dangerous@example.com' };

      vi.mocked(userAuthService.DANGEROUSLY_authenticateWithUserId).mockResolvedValue({
        user: mockUser
      } as any);

      let result = await authenticationService.DANGEROUSLY_authenticateWithUserId({
        userId: 'user-1',
        context: mockContext
      });

      expect(result.type).toBe('user');
      if (result.type === 'user') {
        expect(result.user).toEqual(mockUser);
        expect(result.userSession).toBeUndefined();
        expect(result.orgScopes).toEqual(scopes);
      }

      expect(userAuthService.DANGEROUSLY_authenticateWithUserId).toHaveBeenCalledWith({
        userId: 'user-1',
        context: mockContext
      });
    });

    it('should return full scopes even without session', async () => {
      vi.mocked(userAuthService.DANGEROUSLY_authenticateWithUserId).mockResolvedValue({
        user: { id: 'user-1' }
      } as any);

      let result = await authenticationService.DANGEROUSLY_authenticateWithUserId({
        userId: 'user-1',
        context: mockContext
      });

      expect(result.type).toBe('user');
      if (result.type === 'user') {
        expect(result.orgScopes).toEqual(scopes);
      }
    });

    it('should handle non-existent user', async () => {
      vi.mocked(userAuthService.DANGEROUSLY_authenticateWithUserId).mockRejectedValue(
        new Error('User not found')
      );

      await expect(
        authenticationService.DANGEROUSLY_authenticateWithUserId({
          userId: 'non-existent',
          context: mockContext
        })
      ).rejects.toThrow('User not found');
    });
  });

  describe('authenticateApiKey - instance tokens', () => {
    it('should authenticate instance_publishable token with restricted scopes', async () => {
      let mockOrg = { id: 'org-1', slug: 'test-org', name: 'Test Org' };
      let mockActor = { id: 'actor-1', organizationId: 'org-1' };
      let mockProject = { id: 'proj-1', name: 'Test Project' };
      let mockInstance = {
        id: 'inst-1',
        slug: 'test-instance',
        project: mockProject
      };
      let mockMachineAccess = {
        type: 'instance_publishable',
        organization: mockOrg,
        actor: mockActor,
        instance: mockInstance
      };
      let mockApiKey = { id: 'key-1', machineAccess: mockMachineAccess };

      vi.mocked(machineAccessAuthService.authenticateWithMachineAccessToken).mockResolvedValue({
        apiKey: mockApiKey
      } as any);

      let result = await authenticationService.authenticate({
        type: 'api_key',
        apiKey: 'pk_pub_123',
        context: mockContext
      });

      expect(result.type).toBe('machine');
      if (result.type === 'machine') {
        expect(result.apiKey).toEqual(mockApiKey);
        expect(result.machineAccess).toEqual(mockMachineAccess);
        expect(result.orgScopes).toEqual(instancePublishableTokenScopes);
        expect(result.restrictions.type).toBe('instance');
        if (result.restrictions.type === 'instance') {
          expect(result.restrictions.organization).toEqual(mockOrg);
          expect(result.restrictions.actor).toEqual(mockActor);
          expect(result.restrictions.instance).toEqual(mockInstance);
        }
      }
    });

    it('should authenticate instance_secret token with broader scopes', async () => {
      let mockOrg = { id: 'org-1', slug: 'test-org' };
      let mockActor = { id: 'actor-1' };
      let mockProject = { id: 'proj-1' };
      let mockInstance = {
        id: 'inst-1',
        slug: 'test-instance',
        project: mockProject
      };
      let mockMachineAccess = {
        type: 'instance_secret',
        organization: mockOrg,
        actor: mockActor,
        instance: mockInstance
      };
      let mockApiKey = { id: 'key-1', machineAccess: mockMachineAccess };

      vi.mocked(machineAccessAuthService.authenticateWithMachineAccessToken).mockResolvedValue({
        apiKey: mockApiKey
      } as any);

      let result = await authenticationService.authenticate({
        type: 'api_key',
        apiKey: 'pk_sec_123',
        context: mockContext
      });

      expect(result.type).toBe('machine');
      if (result.type === 'machine') {
        expect(result.orgScopes).toEqual(instanceSecretTokenScopes);
        expect(result.orgScopes.length).toBeGreaterThan(instancePublishableTokenScopes.length);
      }
    });

    it('should throw error if instance token is missing required fields', async () => {
      let mockMachineAccess = {
        type: 'instance_secret',
        organization: { id: 'org-1' },
        // Missing actor and instance
        actor: null,
        instance: null
      };
      let mockApiKey = { id: 'key-1', machineAccess: mockMachineAccess };

      vi.mocked(machineAccessAuthService.authenticateWithMachineAccessToken).mockResolvedValue({
        apiKey: mockApiKey
      } as any);

      await expect(
        authenticationService.authenticate({
          type: 'api_key',
          apiKey: 'pk_invalid_123',
          context: mockContext
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('authenticateApiKey - organization tokens', () => {
    it('should authenticate organization_management token', async () => {
      let mockOrg = { id: 'org-1', slug: 'test-org', name: 'Test Org' };
      let mockActor = { id: 'actor-1', organizationId: 'org-1' };
      let mockMachineAccess = {
        type: 'organization_management',
        organization: mockOrg,
        actor: mockActor
      };
      let mockApiKey = { id: 'key-1', machineAccess: mockMachineAccess };

      vi.mocked(machineAccessAuthService.authenticateWithMachineAccessToken).mockResolvedValue({
        apiKey: mockApiKey
      } as any);

      let result = await authenticationService.authenticate({
        type: 'api_key',
        apiKey: 'pk_org_123',
        context: mockContext
      });

      expect(result.type).toBe('machine');
      if (result.type === 'machine') {
        expect(result.apiKey).toEqual(mockApiKey);
        expect(result.machineAccess).toEqual(mockMachineAccess);
        expect(result.orgScopes).toEqual(orgManagementTokenScopes);
        expect(result.restrictions.type).toBe('organization');
        if (result.restrictions.type === 'organization') {
          expect(result.restrictions.organization).toEqual(mockOrg);
          expect(result.restrictions.actor).toEqual(mockActor);
        }
      }
    });

    it('should throw error if organization token is missing required fields', async () => {
      let mockMachineAccess = {
        type: 'organization_management',
        organization: { id: 'org-1' },
        actor: null // Missing actor
      };
      let mockApiKey = { id: 'key-1', machineAccess: mockMachineAccess };

      vi.mocked(machineAccessAuthService.authenticateWithMachineAccessToken).mockResolvedValue({
        apiKey: mockApiKey
      } as any);

      await expect(
        authenticationService.authenticate({
          type: 'api_key',
          apiKey: 'pk_invalid_123',
          context: mockContext
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should not include user scopes in organization_management token', async () => {
      let mockOrg = { id: 'org-1', slug: 'test-org' };
      let mockActor = { id: 'actor-1' };
      let mockMachineAccess = {
        type: 'organization_management',
        organization: mockOrg,
        actor: mockActor
      };
      let mockApiKey = { id: 'key-1', machineAccess: mockMachineAccess };

      vi.mocked(machineAccessAuthService.authenticateWithMachineAccessToken).mockResolvedValue({
        apiKey: mockApiKey
      } as any);

      let result = await authenticationService.authenticate({
        type: 'api_key',
        apiKey: 'pk_org_123',
        context: mockContext
      });

      if (result.type === 'machine') {
        expect(result.orgScopes).not.toContain('user:read');
        expect(result.orgScopes).not.toContain('user:write');
      }
    });
  });

  describe('authenticateApiKey - invalid tokens', () => {
    it('should throw error for unknown token type', async () => {
      let mockMachineAccess = {
        type: 'unknown_type',
        organization: { id: 'org-1' },
        actor: { id: 'actor-1' }
      };
      let mockApiKey = { id: 'key-1', machineAccess: mockMachineAccess };

      vi.mocked(machineAccessAuthService.authenticateWithMachineAccessToken).mockResolvedValue({
        apiKey: mockApiKey
      } as any);

      await expect(
        authenticationService.authenticate({
          type: 'api_key',
          apiKey: 'pk_unknown_123',
          context: mockContext
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw unauthorized error with appropriate message', async () => {
      let mockMachineAccess = {
        type: 'invalid_type',
        organization: null,
        actor: null
      };
      let mockApiKey = { id: 'key-1', machineAccess: mockMachineAccess };

      vi.mocked(machineAccessAuthService.authenticateWithMachineAccessToken).mockResolvedValue({
        apiKey: mockApiKey
      } as any);

      await expect(
        authenticationService.authenticate({
          type: 'api_key',
          apiKey: 'pk_invalid_123',
          context: mockContext
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should handle authentication service rejection', async () => {
      vi.mocked(machineAccessAuthService.authenticateWithMachineAccessToken).mockRejectedValue(
        new ServiceError(unauthorizedError({ message: 'Invalid API key' }))
      );

      await expect(
        authenticationService.authenticate({
          type: 'api_key',
          apiKey: 'pk_invalid_123',
          context: mockContext
        })
      ).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty session secret', async () => {
      vi.mocked(userAuthService.authenticateWithSessionSecret).mockRejectedValue(
        new Error('Invalid session secret')
      );

      await expect(
        authenticationService.authenticate({
          type: 'user_session',
          sessionClientSecret: '',
          context: mockContext
        })
      ).rejects.toThrow();
    });

    it('should handle empty api key', async () => {
      vi.mocked(machineAccessAuthService.authenticateWithMachineAccessToken).mockRejectedValue(
        new Error('Invalid API key')
      );

      await expect(
        authenticationService.authenticate({
          type: 'api_key',
          apiKey: '',
          context: mockContext
        })
      ).rejects.toThrow();
    });

    it('should preserve context through authentication chain', async () => {
      let customContext = {
        requestId: 'req-123',
        timestamp: Date.now(),
        custom: 'data'
      } as any;

      vi.mocked(userAuthService.authenticateWithSessionSecret).mockResolvedValue({
        user: { id: 'user-1' },
        session: { id: 'session-1' }
      } as any);

      await authenticationService.authenticate({
        type: 'user_session',
        sessionClientSecret: 'secret',
        context: customContext
      });

      expect(userAuthService.authenticateWithSessionSecret).toHaveBeenCalledWith(
        expect.objectContaining({
          context: customContext
        })
      );
    });

    it('should handle machine access with partial data', async () => {
      let mockMachineAccess = {
        type: 'instance_publishable',
        organization: { id: 'org-1' },
        actor: { id: 'actor-1' },
        instance: null // Missing instance
      };
      let mockApiKey = { id: 'key-1', machineAccess: mockMachineAccess };

      vi.mocked(machineAccessAuthService.authenticateWithMachineAccessToken).mockResolvedValue({
        apiKey: mockApiKey
      } as any);

      await expect(
        authenticationService.authenticate({
          type: 'api_key',
          apiKey: 'pk_partial_123',
          context: mockContext
        })
      ).rejects.toThrow();
    });
  });

  describe('scope verification', () => {
    it('should assign correct scopes for each token type', async () => {
      // Test instance_publishable
      vi.mocked(machineAccessAuthService.authenticateWithMachineAccessToken).mockResolvedValue({
        apiKey: {
          id: 'key-1',
          machineAccess: {
            type: 'instance_publishable',
            organization: { id: 'org-1' },
            actor: { id: 'actor-1' },
            instance: { id: 'inst-1', slug: 'inst', project: { id: 'proj-1' } }
          }
        }
      } as any);

      let result1 = await authenticationService.authenticate({
        type: 'api_key',
        apiKey: 'pk_pub',
        context: mockContext
      });

      expect(result1.type).toBe('machine');
      if (result1.type === 'machine') {
        expect(result1.orgScopes).toEqual(instancePublishableTokenScopes);
      }

      // Test instance_secret
      vi.mocked(machineAccessAuthService.authenticateWithMachineAccessToken).mockResolvedValue({
        apiKey: {
          id: 'key-2',
          machineAccess: {
            type: 'instance_secret',
            organization: { id: 'org-1' },
            actor: { id: 'actor-1' },
            instance: { id: 'inst-1', slug: 'inst', project: { id: 'proj-1' } }
          }
        }
      } as any);

      let result2 = await authenticationService.authenticate({
        type: 'api_key',
        apiKey: 'pk_sec',
        context: mockContext
      });

      if (result2.type === 'machine') {
        expect(result2.orgScopes).toEqual(instanceSecretTokenScopes);
      }

      // Test organization_management
      vi.mocked(machineAccessAuthService.authenticateWithMachineAccessToken).mockResolvedValue({
        apiKey: {
          id: 'key-3',
          machineAccess: {
            type: 'organization_management',
            organization: { id: 'org-1' },
            actor: { id: 'actor-1' }
          }
        }
      } as any);

      let result3 = await authenticationService.authenticate({
        type: 'api_key',
        apiKey: 'pk_org',
        context: mockContext
      });

      if (result3.type === 'machine') {
        expect(result3.orgScopes).toEqual(orgManagementTokenScopes);
      }
    });
  });
});
