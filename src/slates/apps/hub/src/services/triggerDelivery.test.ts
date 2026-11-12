import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  receive: vi.fn(),
  findMany: vi.fn(),
  accept: vi.fn()
}));

vi.mock('./triggerInfrastructure', () => {
  let requestsTriggerInfrastructure = (invocation: any) => !!invocation?.googlePubSub;

  return {
    authenticateTriggerDeliveryConfigPush: mocks.receive,
    requestsTriggerInfrastructure,
    isTriggerDeliveryConfig: (registration: any) =>
      registration.type === 'manual' &&
      requestsTriggerInfrastructure(registration.triggerGroup.spec.invocation)
  };
});

vi.mock('../db', () => ({ db: { triggerDeliveryRoute: { findMany: mocks.findMany } } }));

vi.mock('../lib/ingestWebhookRequest', () => ({ acceptWebhookRequest: mocks.accept }));

import { triggerDeliveryService } from './triggerDelivery';

let request = {
  method: 'POST',
  url: 'https://hooks.example.com/receive/whk_global_config',
  headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
  body: {
    encoding: 'base64' as const,
    content: Buffer.from('{"message":{}}').toString('base64')
  }
};

let managed = { type: 'webhook', googlePubSub: { product: 'gmail' } };

let config = {
  id: 'whr_global_config',
  type: 'manual' as const,
  owner: 'global' as const,
  secretOid: 8n,
  tenantOid: null,
  triggerGroup: { spec: { invocation: managed } }
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('shared trigger delivery', () => {
  it('serves exactly the registrations whose trigger group asks for managed delivery', () => {
    let registration = (invocation: unknown) => ({ triggerGroup: { spec: { invocation } } });

    expect(triggerDeliveryService.servesRegistration(registration(managed))).toBe(true);
    expect(triggerDeliveryService.servesRegistration(registration({ type: 'webhook' }))).toBe(
      false
    );
  });

  it('treats only the registration a person set up for such a group as its delivery config', () => {
    let registration = (type: 'manual' | 'automated', invocation: unknown) => ({
      type,
      triggerGroup: { spec: { invocation } }
    });

    expect(triggerDeliveryService.isDeliveryConfig(registration('manual', managed))).toBe(
      true
    );
    expect(triggerDeliveryService.isDeliveryConfig(registration('automated', managed))).toBe(
      false
    );
    expect(
      triggerDeliveryService.isDeliveryConfig(registration('manual', { type: 'webhook' }))
    ).toBe(false);
  });

  it('hands an authenticated delivery to every active registration it addresses', async () => {
    mocks.receive.mockResolvedValue({ ok: true, routingKeys: ['mailbox-a'] });
    mocks.findMany.mockResolvedValue([
      { webhookRegistrationOid: 11n },
      { webhookRegistrationOid: 12n }
    ]);

    await expect(
      triggerDeliveryService.receiveDelivery({ registration: config, request })
    ).resolves.toEqual({ accepted: 2 });

    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          bindingId: 'whr_global_config',
          routingKey: { in: ['mailbox-a'] },
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

  it('hands a delivery on a tenant config to registrations of that tenant only', async () => {
    mocks.receive.mockResolvedValue({ ok: true, routingKeys: ['mailbox-a'] });
    mocks.findMany.mockResolvedValue([{ webhookRegistrationOid: 11n }]);

    await triggerDeliveryService.receiveDelivery({
      registration: { ...config, id: 'whr_tenant_config', owner: 'tenant', tenantOid: 4n },
      request
    });

    expect(mocks.findMany.mock.calls[0]![0].where).toMatchObject({
      bindingId: 'whr_tenant_config',
      webhookRegistration: { status: 'active', tenantOid: 4n }
    });
  });

  it('walks every page of registrations for a widely shared key', async () => {
    mocks.receive.mockResolvedValue({ ok: true, routingKeys: ['mailbox-a'] });
    mocks.findMany
      .mockResolvedValueOnce(
        Array.from({ length: 500 }, (_, i) => ({ webhookRegistrationOid: BigInt(i + 1) }))
      )
      .mockResolvedValueOnce([{ webhookRegistrationOid: 501n }]);

    await expect(
      triggerDeliveryService.receiveDelivery({ registration: config, request })
    ).resolves.toEqual({ accepted: 501 });
    expect(mocks.findMany.mock.calls[1]![0].where.webhookRegistrationOid).toEqual({
      gt: 500n
    });
    expect(mocks.accept).toHaveBeenCalledTimes(501);
  });

  it('hands a widely shared key off in parallel, a bounded number at a time', async () => {
    mocks.receive.mockResolvedValue({ ok: true, routingKeys: ['mailbox-a'] });
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

    await expect(
      triggerDeliveryService.receiveDelivery({ registration: config, request })
    ).resolves.toEqual({ accepted: 45 });
    expect(mocks.accept).toHaveBeenCalledTimes(45);
    expect(peak).toBe(10);
  });

  it('rejects the delivery when a hand-off fails so the sender repeats it', async () => {
    mocks.receive.mockResolvedValue({ ok: true, routingKeys: ['mailbox-a'] });
    mocks.findMany.mockResolvedValue([
      { webhookRegistrationOid: 11n },
      { webhookRegistrationOid: 12n }
    ]);
    mocks.accept
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('unavailable'));

    await expect(
      triggerDeliveryService.receiveDelivery({ registration: config, request })
    ).rejects.toThrow('unavailable');
  });

  it('stops handing off after a failed batch', async () => {
    mocks.receive.mockResolvedValue({ ok: true, routingKeys: ['mailbox-a'] });
    mocks.findMany.mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => ({ webhookRegistrationOid: BigInt(i + 1) }))
    );
    mocks.accept.mockRejectedValueOnce(new Error('unavailable'));

    await expect(
      triggerDeliveryService.receiveDelivery({ registration: config, request })
    ).rejects.toThrow('unavailable');
    expect(mocks.accept).toHaveBeenCalledTimes(10);
  });

  it('gives the verifier the original method, headers and body', async () => {
    mocks.receive.mockResolvedValue({ ok: true, routingKeys: [] });

    await triggerDeliveryService.receiveDelivery({ registration: config, request });

    let verified = mocks.receive.mock.calls[0]![0];
    expect(verified.registration).toBe(config);
    expect([...verified.request.headers.keys()]).toEqual(['authorization']);
    expect(verified.request.method).toBe('POST');
    expect(verified.request.headers.get('authorization')).toBe('Bearer token');
    await expect(verified.request.text()).resolves.toBe('{"message":{}}');
  });

  it('acknowledges a delivery nobody is registered for without creating events', async () => {
    mocks.receive.mockResolvedValue({ ok: true, routingKeys: [] });
    await expect(
      triggerDeliveryService.receiveDelivery({ registration: config, request })
    ).resolves.toEqual({ accepted: 0 });
    expect(mocks.findMany).not.toHaveBeenCalled();

    mocks.receive.mockResolvedValue({ ok: true, routingKeys: ['unknown'] });
    mocks.findMany.mockResolvedValue([]);
    await expect(
      triggerDeliveryService.receiveDelivery({ registration: config, request })
    ).resolves.toEqual({ accepted: 0 });
    expect(mocks.accept).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated delivery with the verifier status and routes nothing', async () => {
    mocks.receive.mockResolvedValue({ ok: false, status: 401 });

    await expect(
      triggerDeliveryService.receiveDelivery({ registration: config, request })
    ).rejects.toMatchObject({ data: { status: 401, code: 'trigger_delivery_rejected' } });
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.accept).not.toHaveBeenCalled();
  });
});
