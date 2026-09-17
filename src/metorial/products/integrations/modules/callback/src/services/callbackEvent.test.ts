import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, getBackend } = vi.hoisted(() => ({
  db: {
    callbackEvent: { findMany: vi.fn(), findFirst: vi.fn() },
    providerVariant: { findUniqueOrThrow: vi.fn() }
  },
  getBackend: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({ build: factory })
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: (factory: any) => ({
      run: async () => await factory({ prisma: async (fn: any) => await fn({}) })
    })
  }
}));

vi.mock('@metorial-subspace/db', () => ({ db }));

vi.mock('@metorial-subspace/provider', () => ({ getBackend }));

vi.mock('@metorial-subspace/list-utils', () => ({
  normalizeDateFilter: (filter: unknown) => filter,
  resolveCallbackInstances: vi.fn(async () => undefined),
  resolveCallbacks: vi.fn(async () => undefined),
  resolveIntegrationProviders: vi.fn(async () => undefined),
  resolveIntegrations: vi.fn(async () => undefined),
  resolveProviders: vi.fn(async () => undefined)
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: async () => ({ oid: 3 }),
  resolveMetorialFacing: async () => ({
    tenant: { oid: BigInt(1) },
    environment: { oid: BigInt(2) }
  })
}));

vi.mock('../lib/callbackIncludes', () => ({ callbackEventInclude: {} }));

import { callbackEventService } from './callbackEvent';

let tenant = { oid: BigInt(1) } as any;
let environment = { oid: BigInt(2) } as any;

describe('callbackEventService ownership scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.callbackEvent.findMany.mockResolvedValue([]);
    db.callbackEvent.findFirst.mockResolvedValue({
      id: 'cbe_1',
      oid: BigInt(900),
      callback: { providerVariantOid: BigInt(7) }
    });
    db.providerVariant.findUniqueOrThrow.mockResolvedValue({ oid: BigInt(7) });
    getBackend.mockResolvedValue({ callbacks: null });
  });

  it('lists only events of user-owned callbacks, scoped to tenant and environment', async () => {
    let paginator = await callbackEventService.listCallbackEventsInternal({
      tenant,
      environment
    });
    await paginator.run({ limit: 10 });

    expect(db.callbackEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantOid: BigInt(1),
          environmentOid: BigInt(2),
          solutionOid: 3,
          callback: { ownership: 'user' }
        })
      })
    );
  });

  it('reads a single event only when its callback is user-owned', async () => {
    let event = await callbackEventService.getCallbackEventByIdInternal({
      tenant,
      environment,
      callbackEventId: 'cbe_1'
    });

    expect(db.callbackEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'cbe_1',
          tenantOid: BigInt(1),
          environmentOid: BigInt(2),
          solutionOid: 3,
          callback: { ownership: 'user' }
        })
      })
    );
    expect(event.details).toBeNull();
  });

  it('includes the backend payload when reading a single event', async () => {
    getBackend.mockResolvedValue({
      callbacks: {
        getManyEvents: vi.fn(async () => ({
          events: [
            {
              status: 'succeeded',
              payload: { action: 'opened' },
              attemptCount: 1,
              error: null
            }
          ]
        })),
        getManyWebhookEvents: vi.fn(async () => ({ webhookEvents: [] }))
      }
    });

    let event = await callbackEventService.getCallbackEventByIdInternal({
      tenant,
      environment,
      callbackEventId: 'cbe_1'
    });

    expect(event.details?.payload).toEqual({ action: 'opened' });
  });

  it('reports a managed callback event as not found rather than returning it', async () => {
    db.callbackEvent.findFirst.mockResolvedValue(null);

    await expect(
      callbackEventService.getCallbackEventByIdInternal({
        tenant,
        environment,
        callbackEventId: 'cbe_managed'
      })
    ).rejects.toThrow();
  });
});
