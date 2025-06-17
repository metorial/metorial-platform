import { ServiceError } from '@metorial/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { machineAccessService } from '../src/services/machineAccess';

// Mocks
vi.mock('@metorial/db', () => ({
  withTransaction: (fn: any) => fn(mockDb),
  ID: { generateId: vi.fn().mockResolvedValue('generated-id') }
}));
vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn().mockResolvedValue(undefined) }
}));
vi.mock('@metorial/module-organization', () => ({
  organizationActorService: {
    createOrganizationActor: vi.fn().mockResolvedValue({ oid: 'actor-oid' })
  }
}));
vi.mock('@metorial/service', () => ({
  Service: {
    create: (_: string, factory: any) => ({
      build: () => factory()
    })
  }
}));

const mockDb = {
  machineAccess: {
    create: vi.fn().mockImplementation(async ({ data }) => ({ ...data, oid: 'ma-oid' })),
    update: vi.fn().mockImplementation(async ({ where, data }) => ({ ...where, ...data }))
  }
};

const baseContext = {} as any;
const baseOrg = { oid: 'org-oid' } as any;
const baseUser = { oid: 'user-oid' } as any;
const baseInstance = { oid: 'instance-oid' } as any;
const baseActor = { oid: 'actor-oid' } as any;

describe('machineAccessService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createMachineAccess', () => {
    it('creates machine access for user_auth_token', async () => {
      const result = await machineAccessService.createMachineAccess({
        type: 'user_auth_token',
        input: { name: 'token' },
        user: baseUser,
        context: baseContext
      });
      expect(result).toMatchObject({
        status: 'active',
        type: 'user_auth_token',
        name: 'token',
        userOid: baseUser.oid,
        organizationOid: null,
        instanceOid: null,
        actorOid: undefined
      });
    });

    it('creates machine access for organization_management', async () => {
      const result = await machineAccessService.createMachineAccess({
        type: 'organization_management',
        input: { name: 'org-mgmt' },
        organization: baseOrg,
        performedBy: baseActor,
        context: baseContext
      });
      expect(result).toMatchObject({
        status: 'active',
        type: 'organization_management',
        name: 'org-mgmt',
        organizationOid: baseOrg.oid,
        actorOid: 'actor-oid'
      });
    });

    it('creates machine access for instance_secret', async () => {
      const result = await machineAccessService.createMachineAccess({
        type: 'instance_secret',
        input: { name: 'inst-secret' },
        organization: baseOrg,
        instance: baseInstance,
        performedBy: baseActor,
        context: baseContext
      });
      expect(result).toMatchObject({
        status: 'active',
        type: 'instance_secret',
        name: 'inst-secret',
        organizationOid: baseOrg.oid,
        instanceOid: baseInstance.oid,
        actorOid: 'actor-oid'
      });
    });
  });

  describe('updateMachineAccess', () => {
    it('updates machine access name for user_auth_token', async () => {
      const machineAccess = {
        oid: 'ma-oid',
        type: 'user_auth_token',
        status: 'active'
      } as any;
      const result = await machineAccessService.updateMachineAccess({
        machineAccess,
        input: { name: 'new-name' },
        context: baseContext
      });
      expect(result).toMatchObject({ oid: 'ma-oid', name: 'new-name' });
    });

    it('throws if performedBy is missing for non-user_auth_token', async () => {
      const machineAccess = {
        oid: 'ma-oid',
        type: 'organization_management',
        status: 'active'
      } as any;
      await expect(
        machineAccessService.updateMachineAccess({
          machineAccess,
          input: { name: 'fail' },
          context: baseContext
        })
      ).rejects.toThrow('WTF - performedBy is required');
    });

    it('throws if machine access is deleted', async () => {
      const machineAccess = {
        oid: 'ma-oid',
        type: 'user_auth_token',
        status: 'deleted'
      } as any;
      await expect(
        machineAccessService.updateMachineAccess({
          machineAccess,
          input: { name: 'fail' },
          context: baseContext
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('deleteMachineAccess', () => {
    it('deletes machine access for user_auth_token', async () => {
      const machineAccess = {
        oid: 'ma-oid',
        type: 'user_auth_token',
        status: 'active'
      } as any;
      const result = await machineAccessService.deleteMachineAccess({
        machineAccess,
        context: baseContext
      });
      expect(result).toMatchObject({ oid: 'ma-oid', status: 'deleted' });
    });

    it('throws if performedBy is missing for non-user_auth_token', async () => {
      const machineAccess = {
        oid: 'ma-oid',
        type: 'organization_management',
        status: 'active'
      } as any;
      await expect(
        machineAccessService.deleteMachineAccess({
          machineAccess,
          context: baseContext
        })
      ).rejects.toThrow('WTF - performedBy is required');
    });

    it('throws if machine access is deleted', async () => {
      const machineAccess = {
        oid: 'ma-oid',
        type: 'user_auth_token',
        status: 'deleted'
      } as any;
      await expect(
        machineAccessService.deleteMachineAccess({
          machineAccess,
          context: baseContext
        })
      ).rejects.toThrow(ServiceError);
    });
  });
});
