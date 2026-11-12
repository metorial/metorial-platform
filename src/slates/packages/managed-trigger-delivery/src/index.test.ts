import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({ verifyPush: vi.fn() }));

vi.mock('@slates/google-pubsub', async importOriginal => ({
  ...(await importOriginal<typeof import('@slates/google-pubsub')>()),
  verifyGooglePubSubPush: mocks.verifyPush
}));

import {
  authenticateTriggerDelivery,
  requestsTriggerInfrastructure,
  selectTriggerDeliveryConfig
} from './index';

let receiveUrl = 'https://hooks.example.com/receive/whk_config';

let googlePubSub = {
  projectId: 'customer-project',
  topicName: 'projects/customer-project/topics/gmail',
  subscriptionName: 'projects/customer-project/subscriptions/gmail-push',
  pushServiceAccountEmail: 'push@customer-project.iam.gserviceaccount.com',
  audience: receiveUrl
};

let payload = { oauthClientId: '123.apps.googleusercontent.com', googlePubSub };

let invocation = { type: 'webhook', googlePubSub: { product: 'gmail' } };

let select = (change: Partial<Parameters<typeof selectTriggerDeliveryConfig>[0]> = {}) =>
  selectTriggerDeliveryConfig({
    invocation,
    oauthClientId: payload.oauthClientId,
    configs: [{ id: 'config', payload }],
    ...change
  });

beforeEach(() => {
  vi.resetAllMocks();
});

describe('choosing a delivery config', () => {
  it('leaves trigger groups without managed delivery alone', () => {
    expect(requestsTriggerInfrastructure({ type: 'webhook' })).toBe(false);
    expect(requestsTriggerInfrastructure(undefined)).toBe(false);
    expect(requestsTriggerInfrastructure(invocation)).toBe(true);
    expect(
      select({ invocation: { type: 'webhook' }, oauthClientId: undefined })
    ).toBeUndefined();
  });

  it('hands out the descriptor of the config set up for the connection OAuth app', () => {
    expect(select()).toEqual({ bindingId: 'config', infrastructure: { googlePubSub } });
  });

  it('takes the first matching config in the order given', () => {
    let other = { ...googlePubSub, audience: 'https://hooks.example.com/receive/whk_other' };

    expect(
      select({
        configs: [
          { id: 'other-app', payload: { ...payload, oauthClientId: 'other-client' } },
          { id: 'first', payload },
          { id: 'second', payload: { ...payload, googlePubSub: other } }
        ]
      })
    ).toEqual({ bindingId: 'first', infrastructure: { googlePubSub } });
  });

  it('matches the OAuth client ID exactly', () => {
    expect(select({ oauthClientId: '123.apps.googleusercontent.com.evil' })).toBeUndefined();
    expect(select({ oauthClientId: 'other-client' })).toBeUndefined();
    expect(select({ configs: [] })).toBeUndefined();
  });

  it.each([
    null,
    'not a config',
    { hook: 42 },
    { googlePubSub },
    { ...payload, oauthClientId: '' },
    { ...payload, googlePubSub: { ...googlePubSub, audience: 'http://hooks.example.com/x' } },
    {
      ...payload,
      googlePubSub: { ...googlePubSub, topicName: 'projects/other-project/topics/gmail' }
    }
  ])('skips a payload that is not a delivery config (%j)', broken => {
    expect(select({ configs: [{ id: 'broken', payload: broken }] })).toBeUndefined();
    expect(
      select({
        configs: [
          { id: 'broken', payload: broken },
          { id: 'config', payload }
        ]
      })?.bindingId
    ).toBe('config');
  });

  it('hands out only the descriptor fields', () => {
    let chosen = select({
      configs: [
        {
          id: 'config',
          payload: {
            ...payload,
            secret: 'kept-out',
            googlePubSub: { ...googlePubSub, secret: 'kept-out' }
          }
        }
      ]
    });

    expect(chosen).toEqual({ bindingId: 'config', infrastructure: { googlePubSub } });
  });

  it('needs a connection that uses an OAuth app', () => {
    expect(() => select({ oauthClientId: undefined })).toThrow(/uses an OAuth app/);
  });

  it.each([
    { googlePubSub: { product: 'calendar' } },
    { googlePubSub: { product: 'gmail', publisher: 'attacker@example.com' } },
    { googlePubSub: null }
  ])('rejects an unsupported capability (%j)', unsupported => {
    expect(() => select({ invocation: unsupported })).toThrow(/unsupported/);
  });
});

describe('authenticating a push', () => {
  let request = () => new Request(receiveUrl, { method: 'POST', body: '{}' });

  let authenticate = (
    change: Partial<Parameters<typeof authenticateTriggerDelivery>[0]> = {}
  ) => authenticateTriggerDelivery({ invocation, payload, request: request(), ...change });

  it('verifies a push against the config and names the registrations it addresses', async () => {
    mocks.verifyPush.mockResolvedValue({
      ok: true,
      message: {
        subscription: googlePubSub.subscriptionName,
        messageId: '1',
        publishTime: '2026-01-01T00:00:00Z',
        attributes: {},
        data: { emailAddress: 'User@Example.com', historyId: '9' }
      }
    });

    await expect(authenticate()).resolves.toEqual({
      ok: true,
      routingKeys: ['gmail:user@example.com']
    });
    expect(mocks.verifyPush).toHaveBeenCalledWith({
      request: expect.any(Request),
      infrastructure: googlePubSub
    });
  });

  it('extracts routing keys for the product of the trigger group', async () => {
    mocks.verifyPush.mockResolvedValue({
      ok: true,
      message: {
        subscription: googlePubSub.subscriptionName,
        messageId: '1',
        publishTime: '2026-01-01T00:00:00Z',
        attributes: { formId: 'form-1' }
      }
    });

    await expect(
      authenticate({ invocation: { type: 'webhook', googlePubSub: { product: 'forms' } } })
    ).resolves.toEqual({ ok: true, routingKeys: ['forms:form-1'] });
  });

  it('rejects a push that fails verification without extracting routing keys', async () => {
    mocks.verifyPush.mockResolvedValue({ ok: false, status: 401, failure: 'token_invalid' });

    await expect(authenticate()).resolves.toEqual({ ok: false, status: 401 });
  });

  it('rejects a push without a token before any signing key is fetched', async () => {
    let actual =
      await vi.importActual<typeof import('@slates/google-pubsub')>('@slates/google-pubsub');
    mocks.verifyPush.mockImplementation(actual.verifyGooglePubSubPush);

    await expect(authenticate()).resolves.toEqual({ ok: false, status: 401 });
    await expect(
      authenticate({ request: new Request(receiveUrl, { method: 'GET' }) })
    ).resolves.toEqual({ ok: false, status: 405 });
  });

  it.each(['body_invalid', 'data_invalid', 'subscription_mismatch'])(
    'acknowledges an authenticated push that can never be routed (%s)',
    async failure => {
      mocks.verifyPush.mockResolvedValue({ ok: false, status: 400, failure });

      await expect(authenticate()).resolves.toEqual({ ok: true, routingKeys: [] });
    }
  );

  it('answers a signing-key outage with its status so the sender retries', async () => {
    mocks.verifyPush.mockResolvedValue({
      ok: false,
      status: 503,
      failure: 'signing_keys_unavailable'
    });

    await expect(authenticate()).resolves.toEqual({ ok: false, status: 503 });
  });

  it.each([
    { payload: { hook: 42 } },
    { payload: null },
    { invocation: { type: 'webhook' } },
    { invocation: { type: 'webhook', googlePubSub: { product: 'calendar' } } }
  ])('rejects a push for something that is not a delivery config (%j)', async change => {
    await expect(authenticate(change)).resolves.toEqual({ ok: false, status: 404 });
    expect(mocks.verifyPush).not.toHaveBeenCalled();
  });
});
