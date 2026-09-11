import { beforeEach, describe, expect, it, vi } from 'vitest';

let listWebhookEvents = vi.fn();
let getWebhookEvent = vi.fn();
let getCallbacksBackends = vi.fn();
let getWebhookRegistrationByIdInternal = vi.fn();
let findManyRegistrations = vi.fn();

vi.mock('@metorial-subspace/db', () => ({
  db: {
    webhookRegistration: { findMany: (...args: any[]) => findManyRegistrations(...args) }
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({ build: factory })
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  resolveMetorialFacing: async () => ({
    tenant: { oid: BigInt(1), id: 'tenant_1' },
    environment: { oid: BigInt(2), id: 'environment_1' },
    solution: { oid: 3, id: 'solution_1' }
  })
}));

vi.mock('../lib/webhookRegistrationIncludes', () => ({
  webhookRegistrationInclude: {}
}));

vi.mock('./webhookRegistration', () => ({
  webhookRegistrationService: {
    getCallbacksBackends: (...args: any[]) => getCallbacksBackends(...args),
    getWebhookRegistrationByIdInternal: (...args: any[]) =>
      getWebhookRegistrationByIdInternal(...args)
  }
}));

let provider = { oid: BigInt(50), id: 'pro_1', name: 'GitHub', type: {} };
let registration = { oid: BigInt(100), id: 'whr_1', provider, providerVariant: {} };

let providerEvent = (id: string, refs: { webhookRegistrationOid?: bigint | null } = {}) => ({
  id,
  status: 'succeeded',
  attemptCount: 1,
  request: { method: 'POST', url: 'https://x/y', headers: {}, body: null },
  provider,
  webhookRegistrationOid:
    refs.webhookRegistrationOid === undefined ? registration.oid : refs.webhookRegistrationOid,
  receivedAt: new Date('2026-01-10T14:45:00Z')
});

let instance = { oid: BigInt(22), id: 'ins_1' } as any;

describe('webhookEventService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getCallbacksBackends.mockResolvedValue([{ listWebhookEvents, getWebhookEvent }]);
    findManyRegistrations.mockResolvedValue([registration]);
  });

  it('translates the backend list into paginator page info and hydrates the registration', async () => {
    listWebhookEvents.mockResolvedValue({
      items: [providerEvent('swe_1'), providerEvent('swe_2')],
      hasMoreAfter: true,
      hasMoreBefore: false
    });

    let { webhookEventService } = await import('./webhookEvent');

    let paginator = await webhookEventService.listWebhookEvents({ instance });
    let list = await paginator.run({ limit: 2, after: 'swe_0' });

    expect(listWebhookEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        webhookRegistrations: undefined,
        input: expect.objectContaining({ limit: 2, after: 'swe_0' })
      })
    );

    expect(list.items.map(i => i.id)).toEqual(['swe_1', 'swe_2']);
    expect(list.items[0]!.webhookRegistration?.id).toBe('whr_1');
    expect(list.items[0]!.provider.id).toBe('pro_1');
    expect(list.pagination).toEqual({ hasNextPage: true, hasPreviousPage: false });
  });

  it('leaves the registration null for an event received on an endpoint the tenant does not own', async () => {
    findManyRegistrations.mockResolvedValue([]);
    listWebhookEvents.mockResolvedValue({
      items: [providerEvent('swe_1', { webhookRegistrationOid: null })],
      hasMoreAfter: false,
      hasMoreBefore: false
    });

    let { webhookEventService } = await import('./webhookEvent');

    let paginator = await webhookEventService.listWebhookEvents({ instance });
    let list = await paginator.run({ limit: 10 });

    expect(findManyRegistrations).not.toHaveBeenCalled();
    expect(list.items[0]!.webhookRegistration).toBeNull();
    expect(list.items[0]!.provider.id).toBe('pro_1');
  });

  it('resolves the registration filter against the tenant before handing it to the backend', async () => {
    getWebhookRegistrationByIdInternal.mockResolvedValue(registration);
    listWebhookEvents.mockResolvedValue({
      items: [],
      hasMoreAfter: false,
      hasMoreBefore: false
    });

    let { webhookEventService } = await import('./webhookEvent');

    let paginator = await webhookEventService.listWebhookEvents({
      instance,
      webhookRegistrationIds: ['whr_1']
    });
    await paginator.run({ limit: 10 });

    expect(getWebhookRegistrationByIdInternal).toHaveBeenCalledWith(
      expect.objectContaining({ webhookRegistrationId: 'whr_1' })
    );
    expect(listWebhookEvents).toHaveBeenCalledWith(
      expect.objectContaining({ webhookRegistrations: [registration] })
    );
  });

  it('reads a single event without a registration to scope it', async () => {
    getWebhookEvent.mockResolvedValue(providerEvent('swe_1'));

    let { webhookEventService } = await import('./webhookEvent');

    let event = await webhookEventService.getWebhookEvent({
      instance,
      webhookEventId: 'swe_1'
    });

    expect(getWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({ webhookEventId: 'swe_1' })
    );
    expect(event.webhookRegistration?.id).toBe('whr_1');
  });

  it('refuses to read across more than one callbacks-capable backend', async () => {
    getCallbacksBackends.mockResolvedValue([
      { listWebhookEvents, getWebhookEvent },
      { listWebhookEvents, getWebhookEvent }
    ]);

    let { webhookEventService } = await import('./webhookEvent');

    await expect(
      webhookEventService.getWebhookEvent({ instance, webhookEventId: 'swe_1' })
    ).rejects.toThrow();
  });

  it('returns an empty page when no backend supports callbacks', async () => {
    getCallbacksBackends.mockResolvedValue([]);

    let { webhookEventService } = await import('./webhookEvent');

    let paginator = await webhookEventService.listWebhookEvents({ instance });
    let list = await paginator.run({ limit: 10 });

    expect(list.items).toEqual([]);
    expect(listWebhookEvents).not.toHaveBeenCalled();
  });
});
