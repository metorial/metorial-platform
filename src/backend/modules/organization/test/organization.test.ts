import { ServiceError } from '@metorial/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { organizationService } from '../src/services/organization';
import { organizationActorService } from '../src/services/organizationActor';
import { organizationMemberService } from '../src/services/organizationMember';

// @ts-ignore
let { db, ID } = await import('@metorial/db');

// Mocks
vi.mock('@metorial/db', () => ({
  db: {
    organization: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    organizationMember: {
      update: vi.fn()
    }
  },
  ID: { generateId: vi.fn() },
  withTransaction: (fn: any) => fn(db)
}));
vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));
vi.mock('@metorial/slugify', () => ({
  createSlugGenerator:
    (fn: any) =>
    async ({ input }: any) =>
      input.toLowerCase().replace(/\s+/g, '-')
}));
vi.mock('../src/services/organizationActor', () => ({
  organizationActorService: {
    createOrganizationActor: vi.fn()
  }
}));
vi.mock('../src/services/organizationMember', () => ({
  organizationMemberService: {
    createOrganizationMember: vi.fn()
  }
}));
vi.mock('@metorial/pagination', () => ({
  Paginator: { create: vi.fn(cb => cb({ prisma: (fn: any) => fn({}) })) }
}));
vi.mock('date-fns', async () => {
  const mod = await vi.importActual<any>('date-fns');
  return {
    ...mod,
    differenceInMinutes: vi.fn(() => 31)
  };
});
vi.mock('@metorial/service', () => ({
  Service: { create: (_: any, fn: any) => ({ build: () => fn() }) }
}));

describe('organizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOrganization', () => {
    it('creates an organization and returns organization, member, and actor', async () => {
      // @ts-ignore
      ID.generateId.mockResolvedValue('org-1');
      // @ts-ignore
      db.organization.create.mockResolvedValue({
        id: 'org-1',
        name: 'Test Org',
        status: 'active'
      });
      // @ts-ignore
      organizationActorService.createOrganizationActor.mockResolvedValue({ id: 'actor-1' });
      // @ts-ignore
      organizationMemberService.createOrganizationMember.mockResolvedValue({
        id: 'member-1',
        actor: { id: 'actor-1' }
      });

      const input = {
        input: { name: 'Test Org' },
        context: {},
        performedBy: { id: 'user-1' }
      };

      // @ts-ignore
      const result = await organizationService.createOrganization(input);

      expect(db.organization.create).toHaveBeenCalled();
      expect(organizationActorService.createOrganizationActor).toHaveBeenCalled();
      expect(organizationMemberService.createOrganizationMember).toHaveBeenCalled();
      expect(result.organization).toBeDefined();
      expect(result.member).toBeDefined();
      expect(result.actor).toBeDefined();
    });
  });

  describe('updateOrganization', () => {
    it('updates an active organization', async () => {
      const org = { id: 'org-1', status: 'active' };
      // @ts-ignore
      db.organization.update.mockResolvedValue({ ...org, name: 'Updated Org' });

      const result = await organizationService.updateOrganization({
        input: { name: 'Updated Org' },
        // @ts-ignore
        organization: org,
        // @ts-ignore
        context: {},
        // @ts-ignore
        performedBy: { id: 'actor-1' }
      });

      expect(db.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { name: 'Updated Org', image: undefined }
      });
      expect(result.name).toBe('Updated Org');
    });

    it('throws if organization is not active', async () => {
      const org = { id: 'org-1', status: 'deleted' };
      await expect(
        organizationService.updateOrganization({
          input: { name: 'Updated Org' },
          // @ts-ignore
          organization: org,
          // @ts-ignore
          context: {},
          // @ts-ignore
          performedBy: { id: 'actor-1' }
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('deleteOrganization', () => {
    it('throws not implemented error for active organization', async () => {
      const org = { id: 'org-1', status: 'active' };
      await expect(
        organizationService.deleteOrganization({
          // @ts-ignore
          organization: org,
          // @ts-ignore
          context: {},
          // @ts-ignore
          performedBy: { id: 'actor-1' }
        })
      ).rejects.toThrow(ServiceError);
    });

    it('throws forbidden error if organization is not active', async () => {
      const org = { id: 'org-1', status: 'deleted' };
      await expect(
        organizationService.deleteOrganization({
          // @ts-ignore
          organization: org,
          // @ts-ignore
          context: {},
          // @ts-ignore
          performedBy: { id: 'actor-1' }
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('getOrganizationByIdForUser', () => {
    it('returns organization, member, and actor if found', async () => {
      // @ts-ignore
      db.organization.findFirst.mockResolvedValue({
        id: 'org-1',
        members: [
          {
            id: 'member-1',
            actor: { id: 'actor-1' },
            user: { id: 'user-1' },
            lastActiveAt: new Date(Date.now() - 31 * 60 * 1000)
          }
        ]
      });
      // @ts-ignore
      db.organizationMember.update.mockResolvedValue({});

      const result = await organizationService.getOrganizationByIdForUser({
        organizationId: 'org-1',
        user: { id: 'user-1' }
      });

      expect(result.organization).toBeDefined();
      expect(result.member).toBeDefined();
      expect(result.actor).toBeDefined();
      expect(db.organizationMember.update).toHaveBeenCalled();
    });

    it('throws not found error if org or member not found', async () => {
      // @ts-ignore
      db.organization.findFirst.mockResolvedValue(null);

      await expect(
        organizationService.getOrganizationByIdForUser({
          organizationId: 'org-1',
          user: { id: 'user-1' }
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('listOrganizations', () => {
    it('returns organizations for user filter', async () => {
      // @ts-ignore
      db.organization.findMany.mockResolvedValue([{ id: 'org-1' }]);
      const paginator = await organizationService.listOrganizations({
        // @ts-ignore
        filter: { type: 'user', user: { oid: 'user-oid' } }
      });
      expect(Array.isArray(paginator)).toBe(true);
    });

    it('returns organizations for actor filter', async () => {
      // @ts-ignore
      db.organization.findMany.mockResolvedValue([{ id: 'org-2' }]);
      const paginator = await organizationService.listOrganizations({
        // @ts-ignore
        filter: { type: 'actor', actor: { oid: 'actor-oid' } }
      });
      expect(Array.isArray(paginator)).toBe(true);
    });
  });

  describe('bootUser', () => {
    it('returns user, organizations, projects, and instances', async () => {
      // @ts-ignore
      db.organization.findMany.mockResolvedValue([
        {
          id: 'org-1',
          members: [{ id: 'member-1' }],
          projects: [{ id: 'proj-1' }],
          instances: [{ id: 'inst-1', project: { id: 'proj-1' } }]
        }
      ]);
      const user = { oid: 'user-oid' };
      // @ts-ignore
      const result = await organizationService.bootUser({ user });
      expect(result.user).toBe(user);
      expect(result.organizations.length).toBe(1);
      expect(result.projects.length).toBe(1);
      expect(result.instances.length).toBe(1);
    });
  });
});
