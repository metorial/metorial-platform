import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
process.env.PUBLIC_SERVICE_URL ??= 'http://subspace.test';
process.env.ENCRYPTION_KEY ??= 'task13-test-encryption-key';

let state = vi.hoisted(() => ({
  outboxFindUnique: vi.fn(),
  outboxFindFirst: vi.fn(),
  outboxUpdateMany: vi.fn(),
  outboxUpdate: vi.fn(),
  outboxCreate: vi.fn(),
  routeFindMany: vi.fn(),
  bindingFindMany: vi.fn(),
  queueAdd: vi.fn()
}));

vi.mock('@lowerdeck/queue', () => ({
  QueueRetryError: class QueueRetryError extends Error {},
  createQueue: () => ({
    add: state.queueAdd,
    process: (handler: unknown) => handler
  }),
  combineQueueProcessors: (processors: unknown[]) => processors
}));
vi.mock('@lowerdeck/cron', () => ({
  createCron: (_opts: unknown, handler: unknown) => handler
}));
vi.mock('@metorial-subspace/db', () => ({
  db: {
    provisionedAppProjectionOutbox: {
      findUnique: state.outboxFindUnique,
      findFirst: state.outboxFindFirst,
      updateMany: state.outboxUpdateMany,
      update: state.outboxUpdate,
      create: state.outboxCreate
    },
    provisionedVendorAppRoute: { findMany: state.routeFindMany },
    provisionedTenantApp: { findMany: state.bindingFindMany }
  },
  getId: () => ({ oid: 90n, id: 'outbox-repair' }),
  addAfterTransactionHook: vi.fn(),
  withTransaction: async (run: (tx: unknown) => unknown) => await run({})
}));

let {
  configureProvisionedAppHubProjectionTransport,
  ensureProjectionOutbox,
  processProvisionedProjectionOutbox,
  reconcileProvisionedAppProjections
} = await import('./provisionTenantApp');

let bindingProjection = {
  version: 1 as const,
  entityKind: 'binding' as const,
  provisionedTenantAppId: 'binding-replacement',
  provisionedRouteId: 'route-1',
  routeIdentifier: 'selector',
  routeGeneration: 2,
  hubTenantId: 'tenant-1',
  callbackInstanceId: 'callback-2',
  hubReceiverId: 'receiver-2',
  hubReceiverGeneration: 2,
  hubReceiverTriggerId: 'trigger-2',
  triggerActionId: 'action-1',
  triggerSpecHash: 'spec-1',
  vendor: 'github',
  purpose: 'shared_provisioned_app',
  externalAppId: 'app-1',
  externalAccountId: null,
  externalInstallationId: 'installation-1',
  externalOwnershipKey: 'owner-key',
  ownerIdentity: 'org:metorial',
  credentialOwnerType: 'byo' as const,
  credentialOwnerRef: 'credentials-1',
  credentialSecretId: 'secret-1',
  credentialSecretPurpose: 'vendor_verification' as const,
  credentialVersion: 1,
  generation: 4,
  status: 'active',
  tombstone: false,
  tombstoneRetainUntil: null,
  expiresAt: null
};

let projection = {
  version: 1 as const,
  entityKind: 'route' as const,
  provisionedRouteId: 'route-1',
  routeIdentifier: 'selector',
  vendor: 'github',
  purpose: 'shared_provisioned_app',
  credentialOwnerRef: 'owner-1',
  generation: 1,
  routeSecretId: 'path-secret-id',
  routeSecretVersion: 1,
  vendorVerificationSecretId: 'vendor-secret-id',
  vendorVerificationVersion: 1,
  status: 'active',
  tombstone: false,
  tombstoneRetainUntil: null,
  expiresAt: null
};

let row = {
  oid: 1n,
  id: 'outbox-1',
  entityKind: 'route' as const,
  entityId: 'route-1',
  generation: 1,
  projectionDigest: 'sha256:digest',
  correlationId: 'correlation-1',
  idempotencyKey: 'idempotency-1',
  payload: projection,
  status: 'pending' as const
};

describe('provisioned-app projection lifecycle queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.outboxFindUnique.mockResolvedValue(row);
    state.outboxFindFirst.mockResolvedValue(null);
    state.outboxUpdateMany.mockResolvedValue({ count: 1 });
    state.routeFindMany.mockResolvedValue([]);
    state.bindingFindMany.mockResolvedValue([]);
  });

  it('marks an outbox delivered only after an exact authenticated acknowledgement', async () => {
    let project = vi.fn().mockResolvedValue({
      generation: 1,
      projectionDigest: 'sha256:digest',
      idempotent: false
    });
    configureProvisionedAppHubProjectionTransport({
      projectProvisionedAppRoute: project,
      projectProvisionedTenantApp: vi.fn(),
      getProvisionedAppProjectionState: vi.fn()
    });
    await expect(processProvisionedProjectionOutbox('outbox-1')).resolves.toEqual({
      status: 'delivered',
      idempotent: false
    });
    expect(project).toHaveBeenCalledWith({
      projection,
      projectionDigest: 'sha256:digest',
      correlationId: 'correlation-1',
      idempotencyKey: 'idempotency-1'
    });
    expect(state.outboxUpdateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'delivering',
          deliveryLeaseExpiresAt: { gt: expect.any(Date) }
        }),
        data: expect.objectContaining({ status: 'delivered' })
      })
    );
  });

  it('does not acknowledge when the worker loses its delivery lease', async () => {
    state.outboxUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    configureProvisionedAppHubProjectionTransport({
      projectProvisionedAppRoute: vi.fn().mockResolvedValue({
        generation: 1,
        projectionDigest: 'sha256:digest',
        idempotent: true
      }),
      projectProvisionedTenantApp: vi.fn(),
      getProvisionedAppProjectionState: vi.fn()
    });
    await expect(processProvisionedProjectionOutbox('outbox-1')).rejects.toThrow(
      'delivery lease lost'
    );
  });

  it('repairs a missed delivery by comparing authoritative generation/digest', async () => {
    let { buildProvisionedRouteProjection, digestProvisionedProjection } =
      await import('../../services/provisionedTenantApp');
    let route = {
      id: 'route-1',
      routeIdentifier: 'selector',
      vendor: 'github',
      purpose: 'shared_provisioned_app',
      credentialOwnerRef: 'owner-1',
      generation: 1,
      routeSecretId: 'path-secret-id',
      routeSecretVersion: 1,
      vendorVerificationSecretId: 'vendor-secret-id',
      vendorVerificationVersion: 1,
      status: 'active',
      expiresAt: null,
      deletedAt: null
    };
    let authoritative = buildProvisionedRouteProjection(route);
    state.routeFindMany.mockResolvedValue([
      {
        ...route,
        projectionDigest: digestProvisionedProjection(authoritative)
      }
    ]);
    state.outboxFindFirst.mockResolvedValue(null);
    state.outboxCreate.mockImplementation(async ({ data }: any) => data);
    configureProvisionedAppHubProjectionTransport({
      projectProvisionedAppRoute: vi.fn(),
      projectProvisionedTenantApp: vi.fn(),
      getProvisionedAppProjectionState: vi.fn().mockResolvedValue(null)
    });
    await reconcileProvisionedAppProjections();
    expect(state.outboxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityKind: 'route',
        entityId: 'route-1',
        generation: 1,
        payload: authoritative
      })
    });
    expect(state.queueAdd).toHaveBeenCalledWith(
      { outboxId: 'outbox-repair' },
      { id: 'provisioned-projection-outbox-repair' }
    );
  });

  it('replays the next historical generation before the current authoritative generation', async () => {
    let { buildProvisionedRouteProjection, digestProvisionedProjection } =
      await import('../../services/provisionedTenantApp');
    let route = {
      ...projection,
      id: 'route-1',
      generation: 3,
      expiresAt: null,
      deletedAt: null
    };
    let authoritative = buildProvisionedRouteProjection(route);
    let historicalProjection = { ...authoritative, generation: 2 };
    let historical = {
      ...row,
      oid: 2n,
      id: 'outbox-generation-2',
      generation: 2,
      projectionDigest: digestProvisionedProjection(historicalProjection),
      payload: historicalProjection,
      status: 'delivered'
    };
    state.routeFindMany.mockResolvedValue([
      { ...route, projectionDigest: digestProvisionedProjection(authoritative) }
    ]);
    state.outboxFindFirst.mockResolvedValue(historical);
    state.outboxUpdate.mockImplementation(async ({ data }: any) => ({
      ...historical,
      ...data
    }));
    configureProvisionedAppHubProjectionTransport({
      projectProvisionedAppRoute: vi.fn(),
      projectProvisionedTenantApp: vi.fn(),
      getProvisionedAppProjectionState: vi.fn().mockResolvedValue({
        generation: 1,
        projectionDigest: 'sha256:hub-generation-1'
      })
    });

    await reconcileProvisionedAppProjections();
    expect(state.outboxUpdate).toHaveBeenCalledWith({
      where: { oid: 2n },
      data: expect.objectContaining({ status: 'pending' })
    });
    expect(state.queueAdd).toHaveBeenCalledWith(
      { outboxId: 'outbox-generation-2' },
      { id: 'provisioned-projection-outbox-generation-2' }
    );
    expect(state.outboxCreate).not.toHaveBeenCalled();
  });

  it('starts a replacement lineage at its earliest real generation and then replays strictly', async () => {
    let { digestProvisionedProjection } = await import('../../services/provisionedTenantApp');
    let generation3 = { ...bindingProjection, generation: 3 };
    let generation4 = { ...bindingProjection, generation: 4 };
    let row3 = {
      ...row,
      oid: 3n,
      id: 'replacement-generation-3',
      entityKind: 'binding' as const,
      entityId: bindingProjection.provisionedTenantAppId,
      generation: 3,
      payload: generation3,
      projectionDigest: digestProvisionedProjection(generation3)
    };
    state.outboxFindFirst.mockResolvedValueOnce(row3);
    state.outboxUpdate.mockImplementation(async ({ data }: any) => ({ ...row3, ...data }));
    let stateResolver = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
      generation: 3,
      projectionDigest: row3.projectionDigest
    });
    configureProvisionedAppHubProjectionTransport({
      projectProvisionedAppRoute: vi.fn(),
      projectProvisionedTenantApp: vi.fn(),
      getProvisionedAppProjectionState: stateResolver
    });

    await ensureProjectionOutbox({
      projection: generation4,
      storedDigest: digestProvisionedProjection(generation4)
    });
    expect(state.queueAdd).toHaveBeenLastCalledWith(
      { outboxId: 'replacement-generation-3' },
      { id: 'provisioned-projection-replacement-generation-3' }
    );

    let row4 = {
      ...row3,
      oid: 4n,
      id: 'replacement-generation-4',
      generation: 4,
      payload: generation4,
      projectionDigest: digestProvisionedProjection(generation4)
    };
    state.outboxFindFirst.mockResolvedValueOnce(row4);
    state.outboxUpdate.mockImplementation(async ({ data }: any) => ({ ...row4, ...data }));
    await ensureProjectionOutbox({
      projection: generation4,
      storedDigest: row4.projectionDigest
    });
    expect(state.queueAdd).toHaveBeenLastCalledWith(
      { outboxId: 'replacement-generation-4' },
      { id: 'provisioned-projection-replacement-generation-4' }
    );
  });

  it('rejects a replacement lineage gap after Hub has accepted its base generation', async () => {
    let { digestProvisionedProjection } = await import('../../services/provisionedTenantApp');
    let generation5 = { ...bindingProjection, generation: 5 };
    state.outboxFindFirst.mockResolvedValue({
      ...row,
      oid: 5n,
      entityKind: 'binding',
      entityId: bindingProjection.provisionedTenantAppId,
      generation: 5,
      payload: generation5,
      projectionDigest: digestProvisionedProjection(generation5)
    });
    configureProvisionedAppHubProjectionTransport({
      projectProvisionedAppRoute: vi.fn(),
      projectProvisionedTenantApp: vi.fn(),
      getProvisionedAppProjectionState: vi.fn().mockResolvedValue({
        generation: 3,
        projectionDigest: 'sha256:generation-3'
      })
    });
    await expect(
      ensureProjectionOutbox({
        projection: generation5,
        storedDigest: digestProvisionedProjection(generation5)
      })
    ).rejects.toThrow('integrity');
  });

  it('idempotently closes replacement repair when Hub already has the exact current digest', async () => {
    let { digestProvisionedProjection } = await import('../../services/provisionedTenantApp');
    let digest = digestProvisionedProjection(bindingProjection);
    configureProvisionedAppHubProjectionTransport({
      projectProvisionedAppRoute: vi.fn(),
      projectProvisionedTenantApp: vi.fn(),
      getProvisionedAppProjectionState: vi.fn().mockResolvedValue({
        generation: bindingProjection.generation,
        projectionDigest: digest
      })
    });
    await ensureProjectionOutbox({ projection: bindingProjection, storedDigest: digest });
    expect(state.outboxUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        entityKind: 'binding',
        entityId: bindingProjection.provisionedTenantAppId,
        generation: bindingProjection.generation,
        projectionDigest: digest
      }),
      data: expect.objectContaining({ status: 'delivered', lastErrorCode: null })
    });
    expect(state.queueAdd).not.toHaveBeenCalled();
  });
});
