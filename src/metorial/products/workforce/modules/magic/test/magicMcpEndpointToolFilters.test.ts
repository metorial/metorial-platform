import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, ensureMagicMcpEndpointBackingMock } = vi.hoisted(() => {
  let db = {
    magicMcpServer: {
      findMany: vi.fn()
    },
    magicMcpEndpointServer: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn()
    },
    magicMcpSession: {
      updateMany: vi.fn()
    },
    magicMcpEndpoint: {
      update: vi.fn(),
      findUniqueOrThrow: vi.fn()
    },
    instance: {
      findUniqueOrThrow: vi.fn()
    }
  };

  return {
    db,
    ensureMagicMcpEndpointBackingMock: vi.fn()
  };
});

vi.mock('@metorial-subspace/module-tenant', () => ({
  assertCanChangeCoreOwnerLock: vi.fn(),
  assertCanUseCoreOwnedResources: vi.fn(),
  getOwnershipAccessor: vi.fn(),
  subspaceScopeService: { ensureForInstance: vi.fn() },
  usableCoreOwnedResourceWhere: vi.fn(() => ({}))
}));

vi.mock('@metorial/db', () => ({
  db,
  ID: {
    generateId: vi.fn(async (prefix: string) => `${prefix}_new`)
  },
  Prisma: {
    JsonNull: 'JSON_NULL'
  },
  withTransaction: async (cb: (db: any) => Promise<any>) => await cb(db)
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: vi.fn()
  }
}));

vi.mock('@metorial/module-flags', () => ({
  flagService: { getFlags: vi.fn() },
  isFlagEnabled: (flag: unknown) => flag === true
}));

vi.mock('@metorial/module-access', () => ({
  consumerMagicMcpReadRoles: ['consumer_magic_mcp_read'],
  consumerMagicMcpWriteRoles: ['consumer_magic_mcp_write']
}));

vi.mock('../src/queues/lifecycle/magicMcpEndpoint', () => ({
  magicMcpEndpointDeletedQueue: { add: vi.fn() }
}));

vi.mock('../src/lib/backing', () => ({
  ensureMagicMcpEndpointBacking: ensureMagicMcpEndpointBackingMock
}));

import { magicMcpEndpointService } from '../src/services/magicMcpEndpoint';

let endpoint = {
  oid: 10n,
  id: 'mep_1',
  instanceOid: 20n
} as any;

let server = {
  oid: 30n,
  id: 'mms_1',
  status: 'active'
};

describe('magicMcpEndpointService endpoint server tool filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.magicMcpServer.findMany.mockResolvedValue([server]);
    db.magicMcpEndpointServer.findMany.mockResolvedValue([{ magicMcpServerOid: server.oid }]);
    db.magicMcpEndpointServer.upsert.mockResolvedValue({});
    db.magicMcpEndpoint.update.mockResolvedValue(endpoint);
    db.magicMcpEndpoint.findUniqueOrThrow.mockResolvedValue(endpoint);
    db.instance.findUniqueOrThrow.mockResolvedValue({ oid: endpoint.instanceOid });
    ensureMagicMcpEndpointBackingMock.mockResolvedValue({
      hasSubspaceBacking: true,
      subspaceEphemeralManagedSessionId: 'ems_1',
      isSubspaceBackingReconciling: false
    });
  });

  it('preserves existing endpoint server filters when toolFilters is omitted', async () => {
    await magicMcpEndpointService.addServersToEndpoint({
      endpoint,
      servers: [{ magicMcpServerId: server.id }]
    });

    expect(db.magicMcpEndpointServer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {}
      })
    );
  });

  it('clears endpoint server filters when toolFilters is explicitly null', async () => {
    await magicMcpEndpointService.addServersToEndpoint({
      endpoint,
      servers: [{ magicMcpServerId: server.id, toolFilters: null }]
    });

    expect(db.magicMcpEndpointServer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          toolFilters: 'JSON_NULL'
        }
      })
    );
  });
});
