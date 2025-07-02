import { ServiceError } from '@metorial/error';
import { instanceService, organizationService } from '@metorial/module-organization';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accessService } from '../src/services/access';

// Mocks
vi.mock('@metorial/module-organization', () => ({
  instanceService: {
    getInstanceByIdForUser: vi.fn(),
    getInstanceById: vi.fn()
  },
  organizationService: {
    getOrganizationByIdForUser: vi.fn()
  }
}));

const mockOrg = { id: 'org1', slug: 'org-slug', name: 'Test Org' };
const mockActor = { id: 'actor1' };
const mockMember = { id: 'member1' };
const mockUser = { id: 'user1' };
const mockInstance = {
  id: 'inst1',
  slug: 'inst-slug',
  organization: mockOrg,
  project: { id: 'proj1' }
};

describe('AccessService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkAccess', () => {
    it('allows access if orgScopes overlap possibleScopes', async () => {
      await expect(
        accessService.checkAccess({
          authInfo: { orgScopes: ['read', 'write'] } as any,
          possibleScopes: ['write' as any]
        })
      ).resolves.toBeUndefined();
    });

    it('throws ServiceError if no orgScopes overlap possibleScopes', async () => {
      await expect(
        accessService.checkAccess({
          authInfo: { orgScopes: ['read'] } as any,
          possibleScopes: ['write' as any]
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('accessOrganization', () => {
    it('returns user org info for user type', async () => {
      (organizationService.getOrganizationByIdForUser as any).mockResolvedValue({
        organization: mockOrg,
        actor: mockActor,
        member: mockMember
      });

      const result = await accessService.accessOrganization({
        authInfo: { type: 'user', user: mockUser } as any,
        organizationId: 'org1'
      });

      expect(result).toEqual({
        type: 'user',
        organization: mockOrg,
        actor: mockActor,
        member: mockMember
      });
    });

    it('returns actor org info for machine type with correct org id', async () => {
      const authInfo = {
        type: 'machine',
        restrictions: { organization: mockOrg, actor: mockActor }
      } as any;

      const result = await accessService.accessOrganization({
        authInfo,
        organizationId: 'org1'
      });

      expect(result).toEqual({
        type: 'actor',
        organization: mockOrg,
        actor: mockActor,
        member: undefined
      });
    });

    it('throws ServiceError if org id does not match for machine', async () => {
      const authInfo = {
        type: 'machine',
        restrictions: { organization: mockOrg, actor: mockActor }
      } as any;

      await expect(
        accessService.accessOrganization({
          authInfo,
          organizationId: 'wrong-id'
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('accessInstance', () => {
    it('returns user instance info for user type', async () => {
      (instanceService.getInstanceByIdForUser as any).mockResolvedValue({
        instance: mockInstance,
        organization: mockOrg,
        actor: mockActor,
        project: mockInstance.project,
        member: mockMember
      });

      const result = await accessService.accessInstance({
        authInfo: { type: 'user', user: mockUser } as any,
        instanceId: 'inst1'
      });

      expect(result).toEqual({
        type: 'user',
        instance: mockInstance,
        organization: mockOrg,
        actor: mockActor,
        project: mockInstance.project,
        member: mockMember
      });
    });

    it('returns user instance info for machine org management', async () => {
      (instanceService.getInstanceById as any).mockResolvedValue({
        ...mockInstance,
        organization: mockOrg,
        project: mockInstance.project
      });

      const authInfo = {
        type: 'machine',
        machineAccess: { type: 'organization_management' },
        restrictions: { organization: mockOrg, actor: mockActor }
      } as any;

      const result = await accessService.accessInstance({
        authInfo,
        instanceId: 'inst1'
      });

      expect(result).toEqual({
        type: 'user',
        instance: mockInstance,
        organization: mockOrg,
        actor: mockActor,
        project: mockInstance.project
      });
    });

    it('returns actor instance info for machine with instance restriction and correct id', async () => {
      const authInfo = {
        type: 'machine',
        machineAccess: {},
        restrictions: {
          organization: mockOrg,
          actor: mockActor,
          instance: { ...mockInstance, project: mockInstance.project }
        }
      } as any;

      const result = await accessService.accessInstance({
        authInfo,
        instanceId: 'inst1'
      });

      expect(result).toEqual({
        type: 'actor',
        instance: { ...mockInstance, organization: mockOrg },
        organization: mockOrg,
        actor: mockActor,
        project: mockInstance.project
      });
    });

    it('throws ServiceError if instance id does not match restriction', async () => {
      const authInfo = {
        type: 'machine',
        machineAccess: {},
        restrictions: {
          organization: mockOrg,
          actor: mockActor,
          instance: { ...mockInstance, project: mockInstance.project }
        }
      } as any;

      await expect(
        accessService.accessInstance({
          authInfo,
          instanceId: 'wrong-id'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('throws ServiceError if no access is allowed', async () => {
      const authInfo = {
        type: 'machine',
        machineAccess: {},
        restrictions: { organization: mockOrg, actor: mockActor }
      } as any;

      await expect(
        accessService.accessInstance({
          authInfo,
          instanceId: 'inst1'
        })
      ).rejects.toThrow(ServiceError);
    });
  });
});
