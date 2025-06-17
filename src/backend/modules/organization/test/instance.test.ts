import { ServiceError } from '@metorial/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { instanceService } from '../src/services/instance';

// @ts-ignore
let { db } = await import('@metorial/db');

vi.mock('@metorial/db', () => ({
  db: {
    instance: {
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
  createSlugGenerator: (fn: any) => vi.fn(async ({ input }: any) => `${input}-slug`)
}));
vi.mock('@metorial/pagination', () => ({
  Paginator: { create: vi.fn(cb => cb({ prisma: (fn: any) => fn({}) })) }
}));
vi.mock('date-fns', () => ({
  differenceInMinutes: vi.fn(() => 31)
}));

const baseOrg = { oid: 'org1' };
const baseProj = { oid: 'proj1' };
const baseActor = { id: 'actor1' };
const baseContext = {};
const baseInstance = {
  oid: 'inst1',
  id: 'inst1',
  status: 'active',
  name: 'Test Instance',
  type: 'type1',
  organizationOid: 'org1',
  projectOid: 'proj1',
  project: baseProj
};
const baseUser = { oid: 'user1' };

describe('InstanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateInstance', () => {
    it('throws if instance is not active', async () => {
      await expect(
        instanceService.updateInstance({
          // @ts-ignore
          instance: { ...baseInstance, status: 'deleted' },
          // @ts-ignore
          organization: baseOrg,
          // @ts-ignore
          performedBy: baseActor,
          // @ts-ignore
          context: baseContext,
          input: { name: 'Updated' }
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('deleteInstance', () => {
    it('throws not implemented error', async () => {
      await expect(
        instanceService.deleteInstance({
          // @ts-ignore
          instance: baseInstance,
          // @ts-ignore
          organization: baseOrg,
          // @ts-ignore
          performedBy: baseActor,
          // @ts-ignore
          context: baseContext
        })
      ).rejects.toThrow(ServiceError);
    });

    it('throws if instance is not active', async () => {
      await expect(
        instanceService.deleteInstance({
          // @ts-ignore
          instance: { ...baseInstance, status: 'deleted' },
          // @ts-ignore
          organization: baseOrg,
          // @ts-ignore
          performedBy: baseActor,
          // @ts-ignore
          context: baseContext
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('getInstanceById', () => {
    it('returns instance if found', async () => {
      // @ts-ignore
      db.instance.findFirst.mockResolvedValue(baseInstance);
      const result = await instanceService.getInstanceById({
        // @ts-ignore
        organization: baseOrg,
        instanceId: 'inst1'
      });
      expect(result).toEqual(baseInstance);
    });

    it('throws if not found', async () => {
      // @ts-ignore
      db.instance.findFirst.mockResolvedValue(null);
      await expect(
        // @ts-ignore
        instanceService.getInstanceById({ organization: baseOrg, instanceId: 'notfound' })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('listInstances', () => {
    it('returns paginated instances', async () => {
      // @ts-ignore
      db.instance.findMany.mockResolvedValue([baseInstance]);
      // @ts-ignore
      const paginator = await instanceService.listInstances({ organization: baseOrg });
      expect(Array.isArray(paginator)).toBe(true);
    });
  });

  describe('getManyInstancesForOrganization', () => {
    it('returns instances for org', async () => {
      // @ts-ignore
      db.instance.findMany.mockResolvedValue([baseInstance]);
      const result = await instanceService.getManyInstancesForOrganization({
        // @ts-ignore
        organization: baseOrg,
        instanceIds: ['inst1']
      });
      expect(result).toEqual([baseInstance]);
    });
  });

  describe('getInstanceByIdForUser', () => {
    it('returns instance, member, actor, project, organization', async () => {
      const member = { id: 'mem1', lastActiveAt: null, actor: { id: 'actor1' } };
      const instanceWithOrg = {
        ...baseInstance,
        organization: { ...baseOrg, members: [member] },
        project: baseProj
      };
      // @ts-ignore
      db.instance.findFirst.mockResolvedValue(instanceWithOrg);
      // @ts-ignore
      db.organizationMember.update.mockResolvedValue({});

      const result = await instanceService.getInstanceByIdForUser({
        instanceId: 'inst1',
        // @ts-ignore
        user: baseUser
      });

      expect(result.instance).toEqual(instanceWithOrg);
      expect(result.member).toEqual(member);
      expect(result.actor).toEqual(member.actor);
      expect(result.project).toEqual(baseProj);
      expect(result.organization).toEqual(instanceWithOrg.organization);
    });

    it('throws if instance or member not found', async () => {
      // @ts-ignore
      db.instance.findFirst.mockResolvedValue(null);
      await expect(
        // @ts-ignore
        instanceService.getInstanceByIdForUser({ instanceId: 'notfound', user: baseUser })
      ).rejects.toThrow(ServiceError);
    });
  });
});
