import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  checkResourceAccess: vi.fn(),
  getMagicMcpServerProviderById: vi.fn(),
  updateMagicMcpServerProvider: vi.fn(),
  createMagicMcpServerProvider: vi.fn(),
  assertCanUseSubspaceResources: vi.fn(),
  assertCanAttachSubspaceResourcesToCoreParent: vi.fn(),
  assertConsumerCanAttachSubspaceResources: vi.fn(),
  getOwnershipAccessor: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {},
  ID: { generateId: vi.fn(async (prefix: string) => `${prefix}_id`) },
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  withTransaction: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({ build: () => factory() }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({ Paginator: { create: vi.fn() } }));
vi.mock('@lowerdeck/slugify', () => ({ slugify: (value: string) => value }));
vi.mock('@metorial/context', () => ({ Context: {} }));
vi.mock('@metorial/fabric', () => ({ Fabric: { fire: vi.fn() } }));
vi.mock('@metorial/id', () => ({ generatePlainId: vi.fn() }));
vi.mock('@metorial/module-access', () => ({
  accessTagService: { checkResourceAccess: mocks.checkResourceAccess },
  consumerMagicMcpReadRoles: [],
  consumerMagicMcpWriteRoles: []
}));
vi.mock('@metorial/module-search', () => ({ searchMagicMcpServerIds: vi.fn() }));
vi.mock('@metorial-subspace/module-integration', () => ({
  integrationInstanceService: {},
  magicMcpServerBackingService: {},
  magicMcpServerProviderService: {
    getMagicMcpServerProviderById: mocks.getMagicMcpServerProviderById,
    updateMagicMcpServerProvider: mocks.updateMagicMcpServerProvider,
    createMagicMcpServerProvider: mocks.createMagicMcpServerProvider
  },
  providerTemplateBackingService: {},
  resolveProviderAttachmentAuthMethodInternal: vi.fn()
}));
vi.mock('@metorial-subspace/module-provider-internal', () => ({
  assertAuthMethodAllowedForTenant: vi.fn()
}));
vi.mock('@metorial-subspace/module-session', () => ({ sessionTemplateService: {} }));
vi.mock('@metorial-subspace/module-tenant', () => ({
  assertCanAttachSubspaceResourcesToCoreParent:
    mocks.assertCanAttachSubspaceResourcesToCoreParent,
  assertCanChangeCoreOwnerLock: vi.fn(),
  assertCanChangeCoreOwnerOnlyVisibility: vi.fn(),
  assertCanSeeCoreOwnedResource: vi.fn(),
  assertCanUseSubspaceResources: mocks.assertCanUseSubspaceResources,
  assertConsumerCanAttachSubspaceResources: mocks.assertConsumerCanAttachSubspaceResources,
  getOwnershipAccessor: mocks.getOwnershipAccessor,
  internalOwnershipAccessor: { kind: 'internal' },
  ownedCoreResourceWhere: vi.fn(() => ({ AND: [] })),
  subspaceScopeService: {
    ensureForInstance: vi.fn(async () => ({ tenant: { oid: 1n }, environment: { oid: 2n } }))
  }
}));
vi.mock('../src/lib/backing', () => ({
  applyMagicMcpServerBacking: vi.fn(),
  ensureMagicMcpServerBacking: vi.fn(),
  getConsumerOwnerForServer: vi.fn(),
  getMagicMcpServerBackingCoreFields: vi.fn(),
  healMagicMcpServerBacking: vi.fn()
}));
vi.mock('../src/queues/lifecycle/magicMcpServer', () => ({
  magicMcpServerCreatedQueue: { add: vi.fn() },
  magicMcpServerDeletedQueue: { add: vi.fn() },
  magicMcpServerUpdatedQueue: { add: vi.fn() }
}));
vi.mock('../src/queues/lifecycle/magicMcpEndpoint', () => ({
  magicMcpEndpointUpdatedQueue: { addMany: vi.fn() }
}));
vi.mock('../src/services/consumerAccess', () => ({
  getAccessTagFilter: vi.fn(),
  getActiveStatusFilter: vi.fn()
}));

import { magicMcpServerService } from '../src/services/magicMcpServer';

let instance = { oid: 10n, id: 'ins_1' } as any;
let accessTags = { accessTagOid: 5n } as any;
let memberActor = { oid: 6n, type: 'member' } as any;
let server = {
  oid: 20n,
  id: 'mms_1',
  status: 'active',
  hasSubspaceBacking: true,
  ownerActorOid: 100n,
  subspaceIntegrationInstanceId: 'iin_own',
  instanceOid: instance.oid
} as any;

let existingProvider = {
  id: 'msp_1',
  magicMcpServerBacking: { id: server.id },
  integrationProvider: { currentVersion: { config: { id: 'pcf_shared' } } },
  integrationInstanceProvider: {
    currentVersion: { config: { id: 'pcf_current' }, authConfig: { id: 'pac_current' } }
  }
};

describe('magicMcpServerService provider attach checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getMagicMcpServerProviderById.mockResolvedValue(existingProvider);
    mocks.updateMagicMcpServerProvider.mockResolvedValue(existingProvider);
    mocks.createMagicMcpServerProvider.mockResolvedValue(existingProvider);
    mocks.getOwnershipAccessor.mockResolvedValue({ kind: 'member' });
  });

  it("checks a consumer's changed provider resources against the server and its integration instance", async () => {
    await magicMcpServerService.updateMagicMcpServerProvider({
      server,
      instance,
      accessTags,
      magicMcpServerProviderId: 'msp_1',
      input: { providerConfigId: 'pcf_new', providerAuthConfigId: 'pac_new' }
    });

    expect(mocks.assertConsumerCanAttachSubspaceResources).toHaveBeenCalledWith({
      tenant: { oid: 1n },
      parent: server,
      parentIntegrationInstanceId: 'iin_own',
      integrationInstanceIds: undefined,
      providerConfigIds: ['pcf_new'],
      providerAuthConfigIds: ['pac_new'],
      inheritedProviderConfigIds: ['pcf_shared']
    });
    expect(mocks.assertCanAttachSubspaceResourcesToCoreParent).not.toHaveBeenCalled();
    expect(mocks.updateMagicMcpServerProvider).toHaveBeenCalledTimes(1);
  });

  it('does not re-check resources a consumer leaves unchanged', async () => {
    await magicMcpServerService.updateMagicMcpServerProvider({
      server,
      instance,
      accessTags,
      magicMcpServerProviderId: 'msp_1',
      input: { providerConfigId: 'pcf_current', providerAuthConfigId: 'pac_current' }
    });

    expect(mocks.assertConsumerCanAttachSubspaceResources).toHaveBeenCalledWith(
      expect.objectContaining({ providerConfigIds: [null], providerAuthConfigIds: [null] })
    );
  });

  it('does not update the provider when the consumer attach check fails', async () => {
    mocks.assertConsumerCanAttachSubspaceResources.mockRejectedValueOnce(
      new Error('ownership_restricted')
    );

    await expect(
      magicMcpServerService.updateMagicMcpServerProvider({
        server,
        instance,
        accessTags,
        magicMcpServerProviderId: 'msp_1',
        input: { providerAuthConfigId: 'pac_new' }
      })
    ).rejects.toThrow('ownership_restricted');

    expect(mocks.updateMagicMcpServerProvider).not.toHaveBeenCalled();
  });

  it('checks a consumer creating a provider the same way', async () => {
    await magicMcpServerService.createMagicMcpServerProvider({
      server,
      instance,
      accessTags,
      input: { providerId: 'pro_1', providerAuthConfigId: 'pac_new' }
    });

    expect(mocks.assertConsumerCanAttachSubspaceResources).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: server,
        parentIntegrationInstanceId: 'iin_own',
        providerAuthConfigIds: ['pac_new']
      })
    );
  });

  it('keeps member and API key callers on the shared attach check', async () => {
    await magicMcpServerService.updateMagicMcpServerProvider({
      server,
      instance,
      organizationActor: memberActor,
      magicMcpServerProviderId: 'msp_1',
      input: { providerAuthConfigId: 'pac_new' }
    });

    expect(mocks.assertConsumerCanAttachSubspaceResources).not.toHaveBeenCalled();
    expect(mocks.assertCanAttachSubspaceResourcesToCoreParent).toHaveBeenCalledWith({
      accessor: { kind: 'member' },
      tenant: { oid: 1n },
      parent: server,
      integrationInstanceIds: undefined,
      providerConfigIds: [undefined],
      providerAuthConfigIds: ['pac_new']
    });
    expect(mocks.updateMagicMcpServerProvider).toHaveBeenCalledTimes(1);
  });

  it('runs no attach check for callers without an actor', async () => {
    await magicMcpServerService.updateMagicMcpServerProvider({
      server,
      instance,
      magicMcpServerProviderId: 'msp_1',
      input: { providerAuthConfigId: 'pac_new' }
    });

    expect(mocks.assertConsumerCanAttachSubspaceResources).not.toHaveBeenCalled();
    expect(mocks.assertCanAttachSubspaceResourcesToCoreParent).not.toHaveBeenCalled();
    expect(mocks.updateMagicMcpServerProvider).toHaveBeenCalledTimes(1);
  });
});
