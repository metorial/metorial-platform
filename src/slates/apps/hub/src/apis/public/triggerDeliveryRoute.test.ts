import { createError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  receiveDelivery: vi.fn(),
  getRegistration: vi.fn(),
  ingest: vi.fn()
}));

vi.mock('../../env', () => ({ env: { service: { METORIAL_ENV: 'development' } } }));

vi.mock('../../services/slateOAuthHandler', () => ({ slateOAuthHandlerService: {} }));

vi.mock('../../services/slateWebhookRegistration', () => ({
  slateWebhookRegistrationService: { getWebhookRegistrationByUrlKey: mocks.getRegistration }
}));

vi.mock('../../services/triggerDelivery', () => {
  let servesRegistration = (registration: any) =>
    !!registration.triggerGroup.spec.invocation.googlePubSub;

  return {
    triggerDeliveryService: {
      receiveDelivery: mocks.receiveDelivery,
      servesRegistration,
      isDeliveryConfig: (registration: any) =>
        registration.type === 'manual' && servesRegistration(registration)
    }
  };
});

vi.mock('../../lib/ingestWebhookRequest', async () => {
  let { createError } = await import('@lowerdeck/error');

  return {
    ingestWebhookRequest: mocks.ingest,
    MAX_WEBHOOK_BODY_BYTES: 64,
    payloadTooLargeError: createError({
      status: 413,
      code: 'payload_too_large',
      message: 'Too large.'
    })
  };
});

vi.mock('./integrationAttachment', async () => ({
  integrationAttachmentApp: new (await import('hono')).Hono()
}));

vi.mock('./liveInvocation', async () => ({
  liveInvocationApp: new (await import('hono')).Hono()
}));

let { hubApp } = await import('./index');

let managed = { type: 'webhook', googlePubSub: { product: 'gmail' } };

let registration = (change: Record<string, unknown> = {}) => ({
  oid: 1n,
  id: 'whr_config',
  type: 'manual',
  owner: 'global',
  status: 'active',
  triggerGroup: { spec: { invocation: managed } },
  ...change
});

let push = (body: string, path = '/receive/whk_global_config') =>
  hubApp.request(path, {
    method: 'POST',
    headers: {
      authorization: 'Bearer token',
      'content-type': 'application/json',
      cookie: 'session=1'
    },
    body
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('delivery config endpoint', () => {
  let config = registration();

  beforeEach(() => {
    mocks.getRegistration.mockResolvedValue(config);
  });

  it('passes the config and the unchanged request to the delivery service', async () => {
    mocks.receiveDelivery.mockResolvedValue({ accepted: 2 });

    let res = await push('{"message":{}}');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ accepted: 2 });
    expect(mocks.getRegistration).toHaveBeenCalledWith({ urlKey: 'whk_global_config' });
    expect(mocks.receiveDelivery).toHaveBeenCalledWith({
      registration: config,
      request: {
        method: 'POST',
        url: expect.stringMatching(/\/receive\/whk_global_config$/),
        headers: expect.objectContaining({ authorization: 'Bearer token' }),
        body: {
          encoding: 'base64',
          content: Buffer.from('{"message":{}}').toString('base64')
        }
      }
    });
    expect(mocks.receiveDelivery.mock.calls[0]![0].request.headers).not.toHaveProperty(
      'cookie'
    );
    expect(mocks.ingest).not.toHaveBeenCalled();
  });

  it('answers a rejected push with the rejection status so the sender retries', async () => {
    mocks.receiveDelivery.mockRejectedValue(
      new ServiceError(
        createError({
          status: 401,
          code: 'trigger_delivery_rejected',
          message: 'This delivery could not be accepted.'
        })
      )
    );

    expect((await push('{}')).status).toBe(401);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });

  it('refuses an oversized body before the delivery service sees it', async () => {
    let res = await push('x'.repeat(65));

    expect(res.status).toBe(413);
    expect(mocks.receiveDelivery).not.toHaveBeenCalled();
  });

  it.each([
    ['awaiting_setup', 412],
    ['deleted', 410]
  ])('refuses a push for a config that is %s', async (status, expected) => {
    mocks.getRegistration.mockResolvedValue(registration({ status }));

    expect((await push('{}')).status).toBe(expected);
    expect(mocks.receiveDelivery).not.toHaveBeenCalled();
  });

  it('no longer serves the per-binding endpoint', async () => {
    let res = await push('{}', '/trigger-delivery/binding');

    expect(res.status).toBe(404);
    expect(mocks.getRegistration).not.toHaveBeenCalled();
    expect(mocks.receiveDelivery).not.toHaveBeenCalled();
  });
});

describe('direct webhook endpoint', () => {
  it.each(['/receive/key', '/receive/key/suffix'])(
    'refuses %s for an automated registration that managed delivery serves',
    async path => {
      mocks.getRegistration.mockResolvedValue(registration({ type: 'automated' }));

      let res = await push('{}', path);

      expect(res.status).toBe(404);
      expect(mocks.receiveDelivery).not.toHaveBeenCalled();
      expect(mocks.ingest).not.toHaveBeenCalled();
    }
  );

  it.each(['manual', 'automated'])(
    'still accepts a %s registration that receives its webhooks directly',
    async type => {
      let direct = registration({
        type,
        triggerGroup: { spec: { invocation: { type: 'webhook' } } }
      });
      mocks.getRegistration.mockResolvedValue(direct);
      mocks.ingest.mockResolvedValue({ discarded: true, eventId: 'event' });

      let res = await push('{}', '/receive/key');

      expect(res.status).toBe(200);
      expect(mocks.ingest).toHaveBeenCalledWith(
        expect.objectContaining({ registration: direct })
      );
      expect(mocks.receiveDelivery).not.toHaveBeenCalled();
    }
  );
});
