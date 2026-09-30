import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  ensureMagicMcpServerBacking: vi.fn(),
  getIntegrationInstanceById: vi.fn(),
  assertAuthMethodAllowedForTenant: vi.fn(),
  endpointUpdatedAddMany: vi.fn(),
  fabricFire: vi.fn()
}));

vi.mock('@metorial/db', () => {
  let db = {
    magicMcpEndpointServer: { findMany: vi.fn() },
    magicMcpSession: { updateMany: vi.fn() },
    magicMcpServer: { update: vi.fn(), findUniqueOrThrow: vi.fn() }
  };

  return {
    db,
    ID: { generateId: vi.fn(async (prefix: string) => `${prefix}_id`) },
    Prisma: { PrismaClientKnownRequestError: class extends Error {} },
    withTransaction: vi.fn(async (callback: (tx: typeof db) => unknown) => await callback(db))
  };
});

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({ build: () => factory() }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({ Paginator: { create: vi.fn() } }));
vi.mock('@lowerdeck/slugify', () => ({ slugify: (value: string) => value }));
vi.mock('@metorial/context', () => ({ Context: {} }));
vi.mock('@metorial/fabric', () => ({ Fabric: { fire: mocks.fabricFire } }));
vi.mock('@metorial/id', () => ({ generatePlainId: vi.fn() }));
vi.mock('@metorial/module-access', () => ({
  accessTagService: {},
  consumerMagicMcpReadRoles: [],
  consumerMagicMcpWriteRoles: []
}));
vi.mock('@metorial/module-search', () => ({ searchMagicMcpServerIds: vi.fn() }));
vi.mock('@metorial-subspace/module-integration', () => ({
  integrationInstanceService: { getIntegrationInstanceById: mocks.getIntegrationInstanceById },
  magicMcpServerBackingService: {},
  magicMcpServerProviderService: {},
  providerTemplateBackingService: {},
  resolveProviderAttachmentAuthMethodInternal: vi.fn()
}));
vi.mock('@metorial-subspace/module-provider-internal', () => ({
  assertAuthMethodAllowedForTenant: mocks.assertAuthMethodAllowedForTenant
}));
vi.mock('@metorial-subspace/module-session', () => ({ sessionTemplateService: {} }));
vi.mock('@metorial-subspace/module-tenant', () => ({
  subspaceScopeService: {
    ensureForInstance: vi.fn(async () => ({ tenant: { oid: 1n }, environment: { oid: 2n } }))
  }
}));
vi.mock('../src/lib/backing', () => ({
  ensureMagicMcpServerBacking: mocks.ensureMagicMcpServerBacking
}));
vi.mock('../src/queues/lifecycle/magicMcpServer', () => ({
  magicMcpServerCreatedQueue: { add: vi.fn() },
  magicMcpServerDeletedQueue: { add: vi.fn() },
  magicMcpServerUpdatedQueue: { add: vi.fn() }
}));
vi.mock('../src/queues/lifecycle/magicMcpEndpoint', () => ({
  magicMcpEndpointUpdatedQueue: { addMany: mocks.endpointUpdatedAddMany }
}));
vi.mock('../src/services/consumerAccess', () => ({
  getAccessTagFilter: vi.fn(),
  getActiveStatusFilter: vi.fn()
}));

import { db } from '@metorial/db';
import { magicMcpServerService } from '../src/services/magicMcpServer';

let instance = { oid: 10n, id: 'ins_1' } as any;
let auditScope = { organizationOid: 1n } as any;
let server = {
  oid: 20n,
  id: 'mms_1',
  status: 'active',
  source: 'consumer_provider_template',
  providerTemplateId: 'ptb_1',
  subspaceIntegrationInstanceId: 'iin_old',
  instanceOid: instance.oid
} as any;

describe('magicMcpServerService.relinkMagicMcpServerIntegrationInstance', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getIntegrationInstanceById.mockResolvedValue({
      id: 'iin_new',
      integrationInstanceProviders: [
        {
          currentVersion: {
            authConfig: { authMethod: { id: 'pam_1' } },
            integrationProviderVersion: { authMethod: null }
          }
        }
      ]
    });
    (db.magicMcpEndpointServer.findMany as any).mockResolvedValue([
      { magicMcpEndpoint: { oid: 30n, id: 'mme_1' } }
    ]);
    (db.magicMcpServer.update as any).mockResolvedValue({
      ...server,
      subspaceIntegrationInstanceId: 'iin_new'
    });
    (db.magicMcpServer.findUniqueOrThrow as any).mockResolvedValue({
      ...server,
      subspaceIntegrationInstanceId: 'iin_new'
    });
  });

  it('points the server at the new integration instance and rebuilds its backing in place', async () => {
    let relinked = await magicMcpServerService.relinkMagicMcpServerIntegrationInstance({
      server,
      instance,
      auditScope,
      integrationInstanceId: 'iin_new'
    });

    expect(relinked.id).toBe(server.id);
    expect(db.magicMcpServer.update).toHaveBeenCalledWith({
      where: { oid: server.oid },
      data: {
        subspaceIntegrationInstanceId: 'iin_new',
        isSubspaceBackingReconciling: true
      }
    });
    expect(mocks.ensureMagicMcpServerBacking).toHaveBeenCalledWith(
      expect.objectContaining({
        instance,
        server: expect.objectContaining({ subspaceIntegrationInstanceId: 'iin_new' }),
        deferReconcile: false
      })
    );
    expect(mocks.assertAuthMethodAllowedForTenant).toHaveBeenCalledWith({
      tenant: { oid: 1n },
      authMethod: { id: 'pam_1' }
    });
  });

  it('forces existing sessions of the server and its endpoints to reconcile', async () => {
    await magicMcpServerService.relinkMagicMcpServerIntegrationInstance({
      server,
      instance,
      auditScope,
      integrationInstanceId: 'iin_new'
    });

    expect(db.magicMcpSession.updateMany).toHaveBeenCalledWith({
      where: {
        OR: [{ magicMcpServerOid: server.oid }, { magicMcpEndpointOid: { in: [30n] } }]
      },
      data: { isConsumerReconciled: false }
    });
    expect(mocks.endpointUpdatedAddMany).toHaveBeenCalledWith([
      { magicMcpEndpointId: 'mme_1' }
    ]);
    expect(mocks.fabricFire).toHaveBeenCalledWith(
      'magic_mcp.server.updated:after',
      expect.objectContaining({ previousMagicMcpServer: server })
    );
  });

  it('refuses to relink archived servers', async () => {
    await expect(
      magicMcpServerService.relinkMagicMcpServerIntegrationInstance({
        server: { ...server, status: 'archived' },
        instance,
        auditScope,
        integrationInstanceId: 'iin_new'
      })
    ).rejects.toThrow();

    expect(mocks.ensureMagicMcpServerBacking).not.toHaveBeenCalled();
  });
});
