import { ServiceError, notFoundError } from '@metorial/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accessService } from '../src/services/access';
import { AuthInfo } from '../src/services/authentication';

// Mock external dependencies
vi.mock('@metorial/module-organization', () => ({
  organizationService: {
    getOrganizationByIdForUser: vi.fn()
  },
  instanceService: {
    getInstanceByIdForUser: vi.fn(),
    getInstanceById: vi.fn()
  }
}));

import { instanceService, organizationService } from '@metorial/module-organization';

describe('AccessService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkAccess', () => {
    it('should allow access when user has required scope', async () => {
      let authInfo: AuthInfo = {
        type: 'user',
        user: { id: 'user-1', email: 'test@example.com' } as any,
        orgScopes: ['organization:read', 'organization:write']
      };

      await expect(
        accessService.checkAccess({
          authInfo,
          possibleScopes: ['organization:read']
        })
      ).resolves.not.toThrow();
    });

    it('should allow access when user has any of the possible scopes', async () => {
      let authInfo: AuthInfo = {
        type: 'user',
        user: { id: 'user-1' } as any,
        orgScopes: ['organization:read', 'instance.file:write']
      };

      await expect(
        accessService.checkAccess({
          authInfo,
          possibleScopes: ['organization:write', 'instance.file:write', 'user:read']
        })
      ).resolves.not.toThrow();
    });

    it('should throw forbidden error when user lacks required scope', async () => {
      let authInfo: AuthInfo = {
        type: 'user',
        user: { id: 'user-1' } as any,
        orgScopes: ['organization:read']
      };

      await expect(
        accessService.checkAccess({
          authInfo,
          possibleScopes: ['organization:write']
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw forbidden error when possibleScopes is empty', async () => {
      let authInfo: AuthInfo = {
        type: 'user',
        user: { id: 'user-1' } as any,
        orgScopes: ['organization:read']
      };

      await expect(
        accessService.checkAccess({
          authInfo,
          possibleScopes: []
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw forbidden error when user has no scopes', async () => {
      let authInfo: AuthInfo = {
        type: 'user',
        user: { id: 'user-1' } as any,
        orgScopes: []
      };

      await expect(
        accessService.checkAccess({
          authInfo,
          possibleScopes: ['organization:read']
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should work with machine auth info', async () => {
      let authInfo: AuthInfo = {
        type: 'machine',
        apiKey: { id: 'key-1' } as any,
        machineAccess: { type: 'organization_management' } as any,
        orgScopes: ['organization:read', 'instance.server:write'],
        restrictions: {
          type: 'organization',
          organization: { id: 'org-1' } as any,
          actor: { id: 'actor-1' } as any
        }
      };

      await expect(
        accessService.checkAccess({
          authInfo,
          possibleScopes: ['instance.server:write']
        })
      ).resolves.not.toThrow();
    });

    it('should handle multiple required scopes correctly', async () => {
      let authInfo: AuthInfo = {
        type: 'user',
        user: { id: 'user-1' } as any,
        orgScopes: ['organization:read', 'instance.file:read', 'instance.server:read']
      };

      await expect(
        accessService.checkAccess({
          authInfo,
          possibleScopes: ['organization:read', 'organization:write']
        })
      ).resolves.not.toThrow();

      await expect(
        accessService.checkAccess({
          authInfo,
          possibleScopes: ['user:write', 'organization:write']
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('accessOrganization', () => {
    describe('for user auth', () => {
      it('should return organization access for valid user', async () => {
        let mockUser = { id: 'user-1', email: 'test@example.com' };
        let mockOrg = { id: 'org-1', slug: 'test-org', name: 'Test Org' };
        let mockActor = { id: 'actor-1', organizationId: 'org-1' };
        let mockMember = { id: 'member-1', userId: 'user-1', organizationId: 'org-1' };

        vi.mocked(organizationService.getOrganizationByIdForUser).mockResolvedValue({
          organization: mockOrg,
          actor: mockActor,
          member: mockMember
        } as any);

        let authInfo: AuthInfo = {
          type: 'user',
          user: mockUser as any,
          orgScopes: ['organization:read']
        };

        let result = await accessService.accessOrganization({
          authInfo,
          organizationId: 'org-1'
        });

        expect(result.type).toBe('user');
        expect(result.organization).toEqual(mockOrg);
        expect(result.actor).toEqual(mockActor);
        expect(result.member).toEqual(mockMember);

        expect(organizationService.getOrganizationByIdForUser).toHaveBeenCalledWith({
          organizationId: 'org-1',
          user: mockUser
        });
      });

      it('should handle organization access by slug', async () => {
        let mockUser = { id: 'user-1' };
        let mockOrg = { id: 'org-1', slug: 'test-org' };

        vi.mocked(organizationService.getOrganizationByIdForUser).mockResolvedValue({
          organization: mockOrg,
          actor: { id: 'actor-1' },
          member: { id: 'member-1' }
        } as any);

        let authInfo: AuthInfo = {
          type: 'user',
          user: mockUser as any,
          orgScopes: ['organization:read']
        };

        await accessService.accessOrganization({
          authInfo,
          organizationId: 'test-org'
        });

        expect(organizationService.getOrganizationByIdForUser).toHaveBeenCalledWith({
          organizationId: 'test-org',
          user: mockUser
        });
      });

      it('should throw error for non-member user', async () => {
        vi.mocked(organizationService.getOrganizationByIdForUser).mockRejectedValue(
          new ServiceError(notFoundError('organization', 'org-1'))
        );

        let authInfo: AuthInfo = {
          type: 'user',
          user: { id: 'user-1' } as any,
          orgScopes: ['organization:read']
        };

        await expect(
          accessService.accessOrganization({
            authInfo,
            organizationId: 'org-1'
          })
        ).rejects.toThrow(ServiceError);
      });
    });

    describe('for machine auth', () => {
      it('should return organization access for valid machine token by ID', async () => {
        let mockOrg = { id: 'org-1', slug: 'test-org' };
        let mockActor = { id: 'actor-1' };

        let authInfo: AuthInfo = {
          type: 'machine',
          apiKey: { id: 'key-1' } as any,
          machineAccess: { type: 'organization_management' } as any,
          orgScopes: ['organization:read'],
          restrictions: {
            type: 'organization',
            organization: mockOrg as any,
            actor: mockActor as any
          }
        };

        let result = await accessService.accessOrganization({
          authInfo,
          organizationId: 'org-1'
        });

        expect(result.type).toBe('actor');
        expect(result.organization).toEqual(mockOrg);
        expect(result.actor).toEqual(mockActor);
        expect(result.member).toBeUndefined();
      });

      it('should return organization access for valid machine token by slug', async () => {
        let mockOrg = { id: 'org-1', slug: 'test-org' };
        let mockActor = { id: 'actor-1' };

        let authInfo: AuthInfo = {
          type: 'machine',
          apiKey: { id: 'key-1' } as any,
          machineAccess: { type: 'organization_management' } as any,
          orgScopes: ['organization:read'],
          restrictions: {
            type: 'organization',
            organization: mockOrg as any,
            actor: mockActor as any
          }
        };

        let result = await accessService.accessOrganization({
          authInfo,
          organizationId: 'test-org'
        });

        expect(result.type).toBe('actor');
        expect(result.organization).toEqual(mockOrg);
      });

      it('should throw not found error for mismatched organization ID', async () => {
        let mockOrg = { id: 'org-1', slug: 'test-org' };

        let authInfo: AuthInfo = {
          type: 'machine',
          apiKey: { id: 'key-1' } as any,
          machineAccess: { type: 'organization_management' } as any,
          orgScopes: ['organization:read'],
          restrictions: {
            type: 'organization',
            organization: mockOrg as any,
            actor: { id: 'actor-1' } as any
          }
        };

        await expect(
          accessService.accessOrganization({
            authInfo,
            organizationId: 'org-2'
          })
        ).rejects.toThrow(ServiceError);
      });

      it('should throw not found error for mismatched organization slug', async () => {
        let mockOrg = { id: 'org-1', slug: 'test-org' };

        let authInfo: AuthInfo = {
          type: 'machine',
          apiKey: { id: 'key-1' } as any,
          machineAccess: { type: 'organization_management' } as any,
          orgScopes: ['organization:read'],
          restrictions: {
            type: 'organization',
            organization: mockOrg as any,
            actor: { id: 'actor-1' } as any
          }
        };

        await expect(
          accessService.accessOrganization({
            authInfo,
            organizationId: 'different-org'
          })
        ).rejects.toThrow(ServiceError);
      });
    });
  });

  describe('accessInstance', () => {
    describe('for user auth', () => {
      it('should return instance access for valid user', async () => {
        let mockUser = { id: 'user-1' };
        let mockInstance = { id: 'inst-1', slug: 'test-instance' };
        let mockOrg = { id: 'org-1', slug: 'test-org' };
        let mockProject = { id: 'proj-1', name: 'Test Project' };
        let mockActor = { id: 'actor-1' };
        let mockMember = { id: 'member-1' };

        vi.mocked(instanceService.getInstanceByIdForUser).mockResolvedValue({
          instance: mockInstance,
          organization: mockOrg,
          actor: mockActor,
          project: mockProject,
          member: mockMember
        } as any);

        let authInfo: AuthInfo = {
          type: 'user',
          user: mockUser as any,
          orgScopes: ['instance.server:read']
        };

        let result = await accessService.accessInstance({
          authInfo,
          instanceId: 'inst-1'
        });

        expect(result.type).toBe('user');
        expect(result.instance).toEqual(mockInstance);
        expect(result.organization).toEqual(mockOrg);
        expect(result.actor).toEqual(mockActor);
        expect(result.project).toEqual(mockProject);
        expect(result.member).toEqual(mockMember);

        expect(instanceService.getInstanceByIdForUser).toHaveBeenCalledWith({
          instanceId: 'inst-1',
          user: mockUser
        });
      });

      it('should handle instance access by slug', async () => {
        let mockUser = { id: 'user-1' };
        vi.mocked(instanceService.getInstanceByIdForUser).mockResolvedValue({
          instance: { id: 'inst-1', slug: 'my-instance' },
          organization: { id: 'org-1' },
          actor: { id: 'actor-1' },
          project: { id: 'proj-1' },
          member: { id: 'member-1' }
        } as any);

        let authInfo: AuthInfo = {
          type: 'user',
          user: mockUser as any,
          orgScopes: ['instance.server:read']
        };

        await accessService.accessInstance({
          authInfo,
          instanceId: 'my-instance'
        });

        expect(instanceService.getInstanceByIdForUser).toHaveBeenCalledWith({
          instanceId: 'my-instance',
          user: mockUser
        });
      });

      it('should throw error for unauthorized instance access', async () => {
        vi.mocked(instanceService.getInstanceByIdForUser).mockRejectedValue(
          new ServiceError(notFoundError('instance', 'inst-1'))
        );

        let authInfo: AuthInfo = {
          type: 'user',
          user: { id: 'user-1' } as any,
          orgScopes: ['instance.server:read']
        };

        await expect(
          accessService.accessInstance({
            authInfo,
            instanceId: 'inst-1'
          })
        ).rejects.toThrow(ServiceError);
      });
    });

    describe('for machine auth - organization_management', () => {
      it('should return instance access for organization_management token', async () => {
        let mockOrg = { id: 'org-1', slug: 'test-org' };
        let mockActor = { id: 'actor-1' };
        let mockInstance = {
          id: 'inst-1',
          slug: 'test-instance',
          organization: mockOrg,
          project: { id: 'proj-1' }
        };

        vi.mocked(instanceService.getInstanceById).mockResolvedValue(mockInstance as any);

        let authInfo: AuthInfo = {
          type: 'machine',
          apiKey: { id: 'key-1' } as any,
          machineAccess: { type: 'organization_management' } as any,
          orgScopes: ['instance.server:read'],
          restrictions: {
            type: 'organization',
            organization: mockOrg as any,
            actor: mockActor as any
          }
        };

        let result = await accessService.accessInstance({
          authInfo,
          instanceId: 'inst-1'
        });

        expect(result.type).toBe('user');
        expect(result.instance).toEqual(mockInstance);
        expect(result.organization).toEqual(mockInstance.organization);
        expect(result.actor).toEqual(mockActor);
        expect(result.project).toEqual(mockInstance.project);

        expect(instanceService.getInstanceById).toHaveBeenCalled();
      });

      it('should handle instance lookup failure', async () => {
        vi.mocked(instanceService.getInstanceById).mockRejectedValue(
          new ServiceError(notFoundError('instance', 'inst-1'))
        );

        let authInfo: AuthInfo = {
          type: 'machine',
          apiKey: { id: 'key-1' } as any,
          machineAccess: { type: 'organization_management' } as any,
          orgScopes: ['instance.server:read'],
          restrictions: {
            type: 'organization',
            organization: { id: 'org-1' } as any,
            actor: { id: 'actor-1' } as any
          }
        };

        await expect(
          accessService.accessInstance({
            authInfo,
            instanceId: 'inst-1'
          })
        ).rejects.toThrow(ServiceError);
      });
    });

    describe('for machine auth - instance tokens', () => {
      it('should return instance access for valid instance token by ID', async () => {
        let mockOrg = { id: 'org-1', slug: 'test-org' };
        let mockActor = { id: 'actor-1' };
        let mockProject = { id: 'proj-1', name: 'Test Project' };
        let mockInstance = {
          id: 'inst-1',
          slug: 'test-instance',
          project: mockProject
        };

        let authInfo: AuthInfo = {
          type: 'machine',
          apiKey: { id: 'key-1' } as any,
          machineAccess: {
            type: 'instance_secret',
            instance: mockInstance
          } as any,
          orgScopes: ['instance.server:read'],
          restrictions: {
            type: 'instance',
            organization: mockOrg as any,
            actor: mockActor as any,
            instance: mockInstance as any
          }
        };

        let result = await accessService.accessInstance({
          authInfo,
          instanceId: 'inst-1'
        });

        expect(result.type).toBe('actor');
        expect(result.instance).toMatchObject({
          id: 'inst-1',
          slug: 'test-instance',
          organization: mockOrg
        });
        expect(result.organization).toEqual(mockOrg);
        expect(result.actor).toEqual(mockActor);
        expect(result.project).toEqual(mockProject);
      });

      it('should return instance access for valid instance token by slug', async () => {
        let mockOrg = { id: 'org-1', slug: 'test-org' };
        let mockProject = { id: 'proj-1' };
        let mockInstance = {
          id: 'inst-1',
          slug: 'test-instance',
          project: mockProject
        };

        let authInfo: AuthInfo = {
          type: 'machine',
          apiKey: { id: 'key-1' } as any,
          machineAccess: { type: 'instance_secret' } as any,
          orgScopes: ['instance.server:read'],
          restrictions: {
            type: 'instance',
            organization: mockOrg as any,
            actor: { id: 'actor-1' } as any,
            instance: mockInstance as any
          }
        };

        let result = await accessService.accessInstance({
          authInfo,
          instanceId: 'test-instance'
        });

        expect(result.type).toBe('actor');
        expect(result.instance.slug).toBe('test-instance');
      });

      it('should throw not found error for mismatched instance ID', async () => {
        let mockOrg = { id: 'org-1' };
        let mockInstance = { id: 'inst-1', slug: 'test-instance', project: { id: 'proj-1' } };

        let authInfo: AuthInfo = {
          type: 'machine',
          apiKey: { id: 'key-1' } as any,
          machineAccess: { type: 'instance_secret' } as any,
          orgScopes: ['instance.server:read'],
          restrictions: {
            type: 'instance',
            organization: mockOrg as any,
            actor: { id: 'actor-1' } as any,
            instance: mockInstance as any
          }
        };

        await expect(
          accessService.accessInstance({
            authInfo,
            instanceId: 'inst-2'
          })
        ).rejects.toThrow(ServiceError);
      });

      it('should throw not found error for mismatched instance slug', async () => {
        let mockInstance = { id: 'inst-1', slug: 'test-instance', project: { id: 'proj-1' } };

        let authInfo: AuthInfo = {
          type: 'machine',
          apiKey: { id: 'key-1' } as any,
          machineAccess: { type: 'instance_publishable' } as any,
          orgScopes: ['instance.server_listing:read'],
          restrictions: {
            type: 'instance',
            organization: { id: 'org-1' } as any,
            actor: { id: 'actor-1' } as any,
            instance: mockInstance as any
          }
        };

        await expect(
          accessService.accessInstance({
            authInfo,
            instanceId: 'different-instance'
          })
        ).rejects.toThrow(ServiceError);
      });

      it('should throw forbidden error for organization token without instance restrictions', async () => {
        let authInfo: AuthInfo = {
          type: 'machine',
          apiKey: { id: 'key-1' } as any,
          machineAccess: {
            type: 'instance_publishable' // Type suggests instance, but restrictions don't match
          } as any,
          orgScopes: ['instance.server_listing:read'],
          restrictions: {
            type: 'organization', // Wrong restriction type
            organization: { id: 'org-1' } as any,
            actor: { id: 'actor-1' } as any
          }
        };

        await expect(
          accessService.accessInstance({
            authInfo,
            instanceId: 'inst-1'
          })
        ).rejects.toThrow(ServiceError);
      });
    });

    describe('edge cases', () => {
      it('should handle empty instance ID', async () => {
        vi.mocked(instanceService.getInstanceByIdForUser).mockRejectedValue(
          new ServiceError(notFoundError('instance', ''))
        );

        let authInfo: AuthInfo = {
          type: 'user',
          user: { id: 'user-1' } as any,
          orgScopes: ['instance.server:read']
        };

        await expect(
          accessService.accessInstance({
            authInfo,
            instanceId: ''
          })
        ).rejects.toThrow(ServiceError);
      });

      it('should preserve all instance data in response', async () => {
        let mockInstance = {
          id: 'inst-1',
          slug: 'test-instance',
          name: 'Test Instance',
          createdAt: new Date(),
          extra: 'data'
        };

        vi.mocked(instanceService.getInstanceByIdForUser).mockResolvedValue({
          instance: mockInstance,
          organization: { id: 'org-1' },
          actor: { id: 'actor-1' },
          project: { id: 'proj-1' },
          member: { id: 'member-1' }
        } as any);

        let authInfo: AuthInfo = {
          type: 'user',
          user: { id: 'user-1' } as any,
          orgScopes: ['instance.server:read']
        };

        let result = await accessService.accessInstance({
          authInfo,
          instanceId: 'inst-1'
        });

        expect(result.instance).toEqual(mockInstance);
      });
    });
  });

  describe('complex scenarios', () => {
    it('should handle multiple access checks in sequence', async () => {
      let authInfo: AuthInfo = {
        type: 'user',
        user: { id: 'user-1' } as any,
        orgScopes: ['organization:read', 'instance.server:read']
      };

      // First check
      await expect(
        accessService.checkAccess({
          authInfo,
          possibleScopes: ['organization:read']
        })
      ).resolves.not.toThrow();

      // Second check
      await expect(
        accessService.checkAccess({
          authInfo,
          possibleScopes: ['instance.server:read']
        })
      ).resolves.not.toThrow();

      // Third check (should fail)
      await expect(
        accessService.checkAccess({
          authInfo,
          possibleScopes: ['organization:write']
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should handle organization and instance access for same user', async () => {
      let mockUser = { id: 'user-1' };
      let mockOrg = { id: 'org-1', slug: 'test-org' };
      let mockInstance = { id: 'inst-1', slug: 'test-instance' };

      vi.mocked(organizationService.getOrganizationByIdForUser).mockResolvedValue({
        organization: mockOrg,
        actor: { id: 'actor-1' },
        member: { id: 'member-1' }
      } as any);

      vi.mocked(instanceService.getInstanceByIdForUser).mockResolvedValue({
        instance: mockInstance,
        organization: mockOrg,
        actor: { id: 'actor-1' },
        project: { id: 'proj-1' },
        member: { id: 'member-1' }
      } as any);

      let authInfo: AuthInfo = {
        type: 'user',
        user: mockUser as any,
        orgScopes: ['organization:read', 'instance.server:read']
      };

      let orgResult = await accessService.accessOrganization({
        authInfo,
        organizationId: 'org-1'
      });

      let instResult = await accessService.accessInstance({
        authInfo,
        instanceId: 'inst-1'
      });

      expect(orgResult.organization).toEqual(mockOrg);
      expect(instResult.organization).toEqual(mockOrg);
      expect(instResult.instance).toEqual(mockInstance);
    });

    it('should differentiate between user and actor access types', async () => {
      // User access
      vi.mocked(organizationService.getOrganizationByIdForUser).mockResolvedValue({
        organization: { id: 'org-1' },
        actor: { id: 'actor-1' },
        member: { id: 'member-1' }
      } as any);

      let userAuthInfo: AuthInfo = {
        type: 'user',
        user: { id: 'user-1' } as any,
        orgScopes: ['organization:read']
      };

      let userResult = await accessService.accessOrganization({
        authInfo: userAuthInfo,
        organizationId: 'org-1'
      });

      expect(userResult.type).toBe('user');
      expect(userResult.member).toBeDefined();

      // Actor access (machine)
      let machineAuthInfo: AuthInfo = {
        type: 'machine',
        apiKey: { id: 'key-1' } as any,
        machineAccess: { type: 'organization_management' } as any,
        orgScopes: ['organization:read'],
        restrictions: {
          type: 'organization',
          organization: { id: 'org-1', slug: 'test-org' } as any,
          actor: { id: 'actor-1' } as any
        }
      };

      let actorResult = await accessService.accessOrganization({
        authInfo: machineAuthInfo,
        organizationId: 'org-1'
      });

      expect(actorResult.type).toBe('actor');
      expect(actorResult.member).toBeUndefined();
    });
  });
});
