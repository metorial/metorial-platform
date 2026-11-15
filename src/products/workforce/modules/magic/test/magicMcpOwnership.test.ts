import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    magicMcpServer: { findMany: vi.fn() },
    magicMcpEndpoint: { findFirst: vi.fn(), create: vi.fn() },
    magicMcpEndpointServer: { findMany: vi.fn() },
    instance: { findUniqueOrThrow: vi.fn() }
  },
  ensureMagicMcpEndpointBacking: vi.fn(),
  accessor: { isEnforced: false } as any,
  assertCanAttachCoreOwnedResources: vi.fn(),
  assertCanSeeCoreOwnedResource: vi.fn(),
  assertCanUseCoreOwnedResources: vi.fn(),
  ownedCoreResourceWhere: vi.fn(() => ({ AND: [] }))
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  assertCanAttachCoreOwnedResources: mocks.assertCanAttachCoreOwnedResources,
  assertCanChangeCoreOwnerLock: vi.fn(),
  assertCanChangeCoreOwnerOnlyVisibility: vi.fn(),
  assertCanSeeCoreOwnedResource: mocks.assertCanSeeCoreOwnedResource,
  assertCanUseCoreOwnedResources: mocks.assertCanUseCoreOwnedResources,
  getOwnershipAccessor: vi.fn(async () => mocks.accessor),
  internalOwnershipAccessor: { kind: 'internal', isEnforced: false },
  ownedCoreResourceWhere: mocks.ownedCoreResourceWhere,
  subspaceScopeService: { ensureForInstance: vi.fn(async () => ({ tenant: { oid: 1n } })) }
}));

vi.mock('@metorial/db', () => ({
  db: mocks.db,
  ID: { generateId: vi.fn(async (prefix: string) => `${prefix}_new`) },
  Prisma: { JsonNull: 'JSON_NULL', PrismaClientKnownRequestError: class extends Error {} },
  withTransaction: async (cb: (db: any) => Promise<any>) => await cb(mocks.db)
}));

vi.mock('@metorial/fabric', () => ({ Fabric: { fire: vi.fn() } }));
vi.mock('@metorial/module-flags', () => ({
  flagService: { isFlagEnabledForInstance: vi.fn() }
}));
vi.mock('@metorial/module-access', () => ({
  consumerMagicMcpReadRoles: ['consumer_magic_mcp_read'],
  consumerMagicMcpWriteRoles: ['consumer_magic_mcp_write']
}));
vi.mock('../src/queues/lifecycle/magicMcpEndpoint', () => ({
  magicMcpEndpointDeletedQueue: { add: vi.fn() }
}));
vi.mock('../src/lib/backing', () => ({
  ensureMagicMcpEndpointBacking: mocks.ensureMagicMcpEndpointBacking
}));

import { magicMcpEndpointService } from '../src/services/magicMcpEndpoint';

let instance = { oid: 20n, id: 'ins_1' } as any;
let auditScope = { organizationOid: 1n, actor: { type: 'system', id: 'test' } } as any;
let organizationActor = { type: 'member', oid: 5n } as any;

let ownedServer = {
  id: 'mgsr_1',
  oid: 1n,
  name: 'Owned',
  status: 'active',
  ownerActorOid: 7n,
  isOwnerLocked: false,
  isOwnerOnlyVisible: true,
  isSystemOwned: false
};

let sharedServer = {
  ...ownedServer,
  id: 'mgsr_2',
  oid: 2n,
  ownerActorOid: null,
  isOwnerOnlyVisible: false
};

let endpoint = {
  oid: 10n,
  id: 'mgep_1',
  status: 'active',
  instanceOid: instance.oid,
  ownerActorOid: null,
  isOwnerOnlyVisible: false,
  isSystemOwned: false
} as any;

describe('magic MCP endpoint ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCanUseCoreOwnedResources.mockReset();
    mocks.assertCanAttachCoreOwnedResources.mockReset();
    mocks.assertCanSeeCoreOwnedResource.mockReset();
    mocks.accessor = { isEnforced: false };
    mocks.db.magicMcpEndpoint.findFirst.mockResolvedValue(endpoint);
    mocks.db.magicMcpEndpoint.create.mockResolvedValue(endpoint);
    mocks.db.magicMcpEndpointServer.findMany.mockResolvedValue([]);
    mocks.db.instance.findUniqueOrThrow.mockResolvedValue(instance);
    mocks.ensureMagicMcpEndpointBacking.mockResolvedValue({
      hasSubspaceBacking: true,
      subspaceEphemeralManagedSessionId: 'ems_1',
      isSubspaceBackingReconciling: false
    });
  });

  describe('get', () => {
    it('never returns system-owned endpoints by default', async () => {
      await magicMcpEndpointService.getMagicMcpEndpointById({
        instance,
        magicMcpEndpointId: 'mgep_1'
      });

      expect(mocks.db.magicMcpEndpoint.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isSystemOwned: false })
        })
      );
    });

    it('returns system-owned endpoints only when explicitly included', async () => {
      await magicMcpEndpointService.getMagicMcpEndpointById({
        instance,
        magicMcpEndpointId: 'mgep_1',
        includeSystemOwned: true
      });

      expect(mocks.db.magicMcpEndpoint.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isSystemOwned: undefined })
        })
      );
    });

    it('skips the visibility check without an organization actor', async () => {
      await magicMcpEndpointService.getMagicMcpEndpointById({
        instance,
        magicMcpEndpointId: 'mgep_1'
      });

      expect(mocks.assertCanSeeCoreOwnedResource).not.toHaveBeenCalled();
    });

    it('propagates the 404 for an owner-only endpoint of someone else', async () => {
      mocks.assertCanSeeCoreOwnedResource.mockRejectedValue(
        Object.assign(new Error('not found'), { data: { status: 404 } })
      );

      await expect(
        magicMcpEndpointService.getMagicMcpEndpointById({
          instance,
          magicMcpEndpointId: 'mgep_1',
          organizationActor
        })
      ).rejects.toMatchObject({ data: { status: 404 } });
    });
  });

  describe('list', () => {
    it('hides system-owned endpoints through the ownership filter', async () => {
      await magicMcpEndpointService.listMagicMcpEndpoints({ instance });

      expect(mocks.ownedCoreResourceWhere).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'internal' }),
        { ownership: undefined, includeSystemOwned: undefined }
      );
    });

    it('passes the requested ownership filter for an organization actor', async () => {
      await magicMcpEndpointService.listMagicMcpEndpoints({
        instance,
        organizationActor,
        ownership: 'usable'
      });

      expect(mocks.ownedCoreResourceWhere).toHaveBeenCalledWith(mocks.accessor, {
        ownership: 'usable',
        includeSystemOwned: undefined
      });
    });
  });

  describe('create', () => {
    it('behaves as before when ownership is not enforced', async () => {
      mocks.db.magicMcpServer.findMany.mockResolvedValue([ownedServer]);

      await magicMcpEndpointService.createMagicMcpEndpoint({
        instance,
        auditScope,
        organizationActor,
        input: { name: 'Endpoint', servers: [{ magicMcpServerId: ownedServer.id }] }
      });

      let data = mocks.db.magicMcpEndpoint.create.mock.calls[0][0].data;
      expect(data.ownerActorOid).toBeUndefined();
      expect(data.isOwnerOnlyVisible).toBeUndefined();
      expect(data.isSystemOwned).toBe(false);
      expect(mocks.assertCanAttachCoreOwnedResources).not.toHaveBeenCalled();
    });

    it('inherits the owner and owner-only visibility when enforced', async () => {
      mocks.accessor = { isEnforced: true };
      mocks.db.magicMcpServer.findMany.mockResolvedValue([ownedServer]);

      await magicMcpEndpointService.createMagicMcpEndpoint({
        instance,
        auditScope,
        organizationActor,
        input: { name: 'Endpoint', servers: [{ magicMcpServerId: ownedServer.id }] }
      });

      let data = mocks.db.magicMcpEndpoint.create.mock.calls[0][0].data;
      expect(data.ownerActorOid).toBe(7n);
      expect(data.isOwnerOnlyVisible).toBe(true);
      expect(mocks.assertCanAttachCoreOwnedResources).toHaveBeenCalledWith(
        mocks.accessor,
        { ownerActorOid: 7n },
        [ownedServer],
        expect.anything()
      );
    });

    it('does not inherit an owner from shared servers when enforced', async () => {
      mocks.accessor = { isEnforced: true };
      mocks.db.magicMcpServer.findMany.mockResolvedValue([sharedServer]);

      await magicMcpEndpointService.createMagicMcpEndpoint({
        instance,
        auditScope,
        organizationActor,
        input: { name: 'Endpoint', servers: [{ magicMcpServerId: sharedServer.id }] }
      });

      let data = mocks.db.magicMcpEndpoint.create.mock.calls[0][0].data;
      expect(data.ownerActorOid).toBeUndefined();
      expect(mocks.assertCanAttachCoreOwnedResources).not.toHaveBeenCalled();
    });

    it('creates system-owned endpoints without an owner', async () => {
      mocks.accessor = { isEnforced: true };
      mocks.db.magicMcpServer.findMany.mockResolvedValue([ownedServer]);

      await magicMcpEndpointService.createMagicMcpEndpoint({
        instance,
        auditScope,
        organizationActor,
        input: {
          name: 'Endpoint',
          isSystemOwned: true,
          servers: [{ magicMcpServerId: ownedServer.id }]
        }
      });

      let data = mocks.db.magicMcpEndpoint.create.mock.calls[0][0].data;
      expect(data.isSystemOwned).toBe(true);
      expect(data.ownerActorOid).toBeUndefined();
    });

    it('rejects servers the actor may not use, even for internal callers', async () => {
      mocks.db.magicMcpServer.findMany.mockResolvedValue([
        { ...ownedServer, isSystemOwned: true }
      ]);
      mocks.assertCanUseCoreOwnedResources.mockRejectedValue(
        Object.assign(new Error('not found'), { data: { status: 404 } })
      );

      await expect(
        magicMcpEndpointService.createMagicMcpEndpoint({
          instance,
          auditScope,
          input: { name: 'Endpoint', servers: [{ magicMcpServerId: ownedServer.id }] }
        })
      ).rejects.toMatchObject({ data: { status: 404 } });
      expect(mocks.assertCanUseCoreOwnedResources).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'internal' }),
        expect.arrayContaining([expect.objectContaining({ isSystemOwned: true })]),
        expect.anything()
      );
      expect(mocks.db.magicMcpEndpoint.create).not.toHaveBeenCalled();
    });
  });

  describe('addServersToEndpoint', () => {
    it('applies the attach rule to servers that are new to the endpoint', async () => {
      mocks.db.magicMcpServer.findMany.mockResolvedValue([ownedServer]);
      mocks.assertCanAttachCoreOwnedResources.mockRejectedValue(
        Object.assign(new Error('owner mismatch'), { data: { status: 400 } })
      );

      await expect(
        magicMcpEndpointService.addServersToEndpoint({
          endpoint,
          auditScope,
          organizationActor,
          servers: [{ magicMcpServerId: ownedServer.id }]
        })
      ).rejects.toMatchObject({ data: { status: 400 } });
      expect(mocks.assertCanAttachCoreOwnedResources).toHaveBeenCalledWith(
        mocks.accessor,
        endpoint,
        [ownedServer],
        expect.anything()
      );
    });

    it('does not re-check servers that are already attached', async () => {
      mocks.db.magicMcpServer.findMany.mockResolvedValue([ownedServer]);
      mocks.db.magicMcpEndpointServer.findMany.mockResolvedValue([
        { magicMcpServerOid: ownedServer.oid }
      ]);
      mocks.db.magicMcpEndpoint.findFirst.mockResolvedValue(endpoint);

      await magicMcpEndpointService
        .addServersToEndpoint({
          endpoint,
          auditScope,
          organizationActor,
          servers: [{ magicMcpServerId: ownedServer.id }]
        })
        .catch(() => undefined);

      expect(mocks.assertCanAttachCoreOwnedResources).toHaveBeenCalledWith(
        mocks.accessor,
        endpoint,
        [],
        expect.anything()
      );
    });
  });
});
