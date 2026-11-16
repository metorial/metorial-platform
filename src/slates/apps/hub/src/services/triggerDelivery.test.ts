import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  decrypt: vi.fn(),
  authenticate: vi.fn(),
  createInvocation: vi.fn(),
  activeVersion: vi.fn(),
  findTenant: vi.fn(),
  findMany: vi.fn(),
  accept: vi.fn()
}));

vi.mock('../internal/triggerDeliveryConfigServiceInternal', () => ({
  triggerDeliveryConfigServiceInternal: { decryptDeliveryConfig: mocks.decrypt }
}));

vi.mock('./slateInvocation', () => ({
  slateInvocationService: {
    createInvocation: mocks.createInvocation,
    authenticateWebhookDelivery: mocks.authenticate
  }
}));

vi.mock('./tenant', () => ({ globalTenant: { oid: 99n, identifier: '__slates_global__' } }));

vi.mock('../lib/slateVersion', () => ({ getActiveSlateVersion: mocks.activeVersion }));

vi.mock('../db', () => ({
  db: {
    tenant: { findUniqueOrThrow: mocks.findTenant },
    triggerDeliveryRoute: { findMany: mocks.findMany }
  }
}));

vi.mock('../lib/ingestWebhookRequest', () => ({ acceptWebhookRequest: mocks.accept }));

import { triggerDeliveryService } from './triggerDelivery';

let request = {
  method: 'POST',
  url: 'https://hooks.example.com/receive/whk_global_config',
  headers: {
    authorization: 'Bearer token',
    'content-type': 'application/json',
    'x-signature': 'signed'
  },
  body: {
    encoding: 'base64' as const,
    content: Buffer.from('{"message":{}}').toString('base64')
  }
};

let slate = { oid: 7n, id: 'slate' } as any;

let config = {
  id: 'whr_global_config',
  owner: 'global' as const,
  secretOid: 8n,
  tenantOid: null,
  slate,
  triggerGroup: { key: 'mail' }
};

let tenantConfig = {
  ...config,
  id: 'whr_tenant_config',
  owner: 'tenant' as const,
  tenantOid: 4n
};

let authenticated = (result: Record<string, unknown>) =>
  mocks.authenticate.mockResolvedValue({
    status: 'success',
    invocation: { oid: 1n },
    data: result
  });

let receive = (registration: typeof config | typeof tenantConfig = config) =>
  triggerDeliveryService.receiveDelivery({ registration, request });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.decrypt.mockResolvedValue({ topic: 'shared' });
  mocks.activeVersion.mockResolvedValue({ id: 'version' });
  mocks.createInvocation.mockImplementation(async (d: any) => ({ stack: d }));
  mocks.findTenant.mockResolvedValue({ oid: 4n });
});

describe('the registrations shared delivery serves', () => {
  let group = (invocation: unknown) => ({ triggerGroup: { spec: { invocation } } }) as any;

  it('serves exactly the registrations of an automatic group that declares a delivery config', () => {
    expect(
      triggerDeliveryService.servesRegistration(
        group({
          type: 'webhook',
          registration: {
            mode: 'auto',
            deliveryConfig: { userConfigSchema: {}, fullConfigSchema: {} }
          }
        })
      )
    ).toBe(true);
    expect(
      triggerDeliveryService.servesRegistration(
        group({ type: 'webhook', registration: { mode: 'auto' } })
      )
    ).toBe(false);
    expect(
      triggerDeliveryService.servesRegistration(
        group({
          type: 'webhook',
          registration: { mode: 'manual', userConfigSchema: {}, fullConfigSchema: {} }
        })
      )
    ).toBe(false);
  });
});

describe('authenticating a push', () => {
  it('asks the integration as the global tenant with the stored request and the saved config', async () => {
    authenticated({ routingKeys: [] });

    await receive();

    expect(mocks.findTenant).not.toHaveBeenCalled();
    expect(mocks.decrypt).toHaveBeenCalledWith({
      registration: config,
      tenant: expect.objectContaining({ oid: 99n })
    });
    expect(mocks.activeVersion).toHaveBeenCalledWith({ slate });
    expect(mocks.createInvocation).toHaveBeenCalledWith({
      participants: [],
      slateVersion: { id: 'version' },
      tenant: expect.objectContaining({ oid: 99n })
    });
    expect(mocks.authenticate).toHaveBeenCalledWith({
      stack: { stack: expect.objectContaining({ slateVersion: { id: 'version' } }) },
      triggerGroupId: 'mail',
      url: request.url,
      method: 'POST',
      headers: request.headers,
      body: request.body,
      deliveryConfig: { topic: 'shared' }
    });
  });

  it('asks the integration as the tenant that owns a tenant config', async () => {
    authenticated({ routingKeys: [] });

    await receive(tenantConfig);

    expect(mocks.findTenant).toHaveBeenCalledWith({ where: { oid: 4n } });
    expect(mocks.decrypt).toHaveBeenCalledWith({
      registration: tenantConfig,
      tenant: { oid: 4n }
    });
    expect(mocks.createInvocation.mock.calls[0]![0].tenant).toEqual({ oid: 4n });
  });

  it('answers with the status the integration rejects a push with and routes nothing', async () => {
    authenticated({ routingKeys: ['mailbox-a'], rejected: { status: 401 } });

    await expect(receive()).rejects.toMatchObject({
      data: { status: 401, code: 'trigger_delivery_rejected' }
    });
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.accept).not.toHaveBeenCalled();
  });

  it('treats a null rejection as accepted', async () => {
    authenticated({ routingKeys: [], rejected: null });

    await expect(receive()).resolves.toEqual({ accepted: 0 });
  });

  it.each([
    [
      'the integration returns an error',
      () =>
        mocks.authenticate.mockResolvedValue({
          status: 'error',
          invocation: { oid: 1n },
          error: { code: 'boom', message: 'Boom.' }
        })
    ],
    [
      'the invocation throws',
      () => mocks.authenticate.mockRejectedValue(new Error('sandbox unavailable'))
    ],
    [
      'no version is deployed',
      () => mocks.activeVersion.mockRejectedValue(new Error('not deployed'))
    ]
  ])('asks the sender to retry when %s', async (_, arrange) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    arrange();

    await expect(receive()).rejects.toMatchObject({
      data: { status: 503, code: 'trigger_delivery_unavailable' }
    });
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.accept).not.toHaveBeenCalled();
  });
});

describe('a push that could not be checked', () => {
  it('is reported with the config it arrived on', async () => {
    let logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    let failure = new Error('sandbox unavailable');
    mocks.authenticate.mockRejectedValue(failure);

    await expect(receive()).rejects.toMatchObject({ data: { status: 503 } });
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('cfg:'), failure);
  });
});

describe('routing an authenticated push', () => {
  it('hands it to every active registration that holds one of its keys', async () => {
    authenticated({ routingKeys: ['mailbox-a', 'mailbox-b'] });
    mocks.findMany.mockResolvedValue([
      { webhookRegistrationOid: 11n },
      { webhookRegistrationOid: 12n }
    ]);

    await expect(receive()).resolves.toEqual({ accepted: 2 });

    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          bindingId: 'whr_global_config',
          routingKey: { in: ['mailbox-a', 'mailbox-b'] },
          webhookRegistrationOid: undefined,
          webhookRegistration: { status: 'active', tenantOid: undefined }
        },
        distinct: ['webhookRegistrationOid']
      })
    );
    expect(mocks.accept.mock.calls.map(([call]) => call)).toEqual([
      { registration: { oid: 11n }, request },
      { registration: { oid: 12n }, request }
    ]);
  });

  it('hands a push on a tenant config to registrations of that tenant only', async () => {
    authenticated({ routingKeys: ['mailbox-a'] });
    mocks.findMany.mockResolvedValue([{ webhookRegistrationOid: 11n }]);

    await receive(tenantConfig);

    expect(mocks.findMany.mock.calls[0]![0].where).toMatchObject({
      bindingId: 'whr_tenant_config',
      webhookRegistration: { status: 'active', tenantOid: 4n }
    });
  });

  it('acknowledges an authenticated push without keys and hands it to nobody', async () => {
    authenticated({ routingKeys: [] });

    await expect(receive()).resolves.toEqual({ accepted: 0 });
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.accept).not.toHaveBeenCalled();
  });

  it('acknowledges a push whose keys nobody holds', async () => {
    authenticated({ routingKeys: ['unknown'] });
    mocks.findMany.mockResolvedValue([]);

    await expect(receive()).resolves.toEqual({ accepted: 0 });
    expect(mocks.accept).not.toHaveBeenCalled();
  });

  it('walks every page of registrations for a widely shared key', async () => {
    authenticated({ routingKeys: ['mailbox-a'] });
    mocks.findMany
      .mockResolvedValueOnce(
        Array.from({ length: 500 }, (_, i) => ({ webhookRegistrationOid: BigInt(i + 1) }))
      )
      .mockResolvedValueOnce([{ webhookRegistrationOid: 501n }]);

    await expect(receive()).resolves.toEqual({ accepted: 501 });
    expect(mocks.findMany.mock.calls[1]![0].where.webhookRegistrationOid).toEqual({
      gt: 500n
    });
    expect(mocks.accept).toHaveBeenCalledTimes(501);
  });

  it('hands a widely shared key off in parallel, a bounded number at a time', async () => {
    authenticated({ routingKeys: ['mailbox-a'] });
    mocks.findMany.mockResolvedValue(
      Array.from({ length: 45 }, (_, i) => ({ webhookRegistrationOid: BigInt(i + 1) }))
    );
    let running = 0;
    let peak = 0;
    mocks.accept.mockImplementation(async () => {
      peak = Math.max(peak, ++running);
      await new Promise(resolve => setTimeout(resolve, 1));
      running--;
    });

    await expect(receive()).resolves.toEqual({ accepted: 45 });
    expect(mocks.accept).toHaveBeenCalledTimes(45);
    expect(peak).toBe(10);
  });

  it('rejects the push when a hand-off fails so the sender repeats it', async () => {
    authenticated({ routingKeys: ['mailbox-a'] });
    mocks.findMany.mockResolvedValue([
      { webhookRegistrationOid: 11n },
      { webhookRegistrationOid: 12n }
    ]);
    mocks.accept
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('unavailable'));

    await expect(receive()).rejects.toThrow('unavailable');
  });

  it('stops handing off after a failed batch', async () => {
    authenticated({ routingKeys: ['mailbox-a'] });
    mocks.findMany.mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => ({ webhookRegistrationOid: BigInt(i + 1) }))
    );
    mocks.accept.mockRejectedValueOnce(new Error('unavailable'));

    await expect(receive()).rejects.toThrow('unavailable');
    expect(mocks.accept).toHaveBeenCalledTimes(10);
  });
});
