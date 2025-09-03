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
});
