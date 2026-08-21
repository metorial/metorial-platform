import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  accessInstance: vi.fn(),
  checkAccess: vi.fn(),
  checkTargetAccess: vi.fn(),
  getCallback: vi.fn(),
  getCallbackInstance: vi.fn(),
  sendDashboardTestEvent: vi.fn(),
  createReceiverPathSecret: vi.fn(),
  rotateReceiverPathSecret: vi.fn()
}));

vi.mock('@metorial/module-access', () => ({
  accessService: {
    accessInstance: mocks.accessInstance,
    checkAccess: mocks.checkAccess,
    checkTargetAccess: mocks.checkTargetAccess
  }
}));
vi.mock('@metorial/audit-scope', () => ({ createAuditScope: vi.fn(() => ({})) }));
vi.mock('@metorial/consumer-auth', () => ({
  getConsumerAccessContextForConsumerProfile: vi.fn()
}));
vi.mock('@metorial/module-consumer-core', () => ({ consumerProfileService: {} }));
vi.mock('@metorial/module-resource-actor', () => ({ resourceActorService: {} }));
vi.mock('@metorial/module-flags', () => ({ flagService: {} }));
vi.mock('@metorial-subspace/module-auth', () => ({
  providerAuthConfigService: { getProviderAuthConfigById: vi.fn() }
}));
vi.mock('@metorial-subspace/module-deployment', () => ({
  providerConfigService: { getProviderConfigById: vi.fn() }
}));
vi.mock('@metorial-subspace/module-callback', () => ({
  callbackService: { getCallbackById: mocks.getCallback },
  callbackInstanceService: {
    get: mocks.getCallbackInstance,
    createReceiverPathSecret: mocks.createReceiverPathSecret,
    rotateReceiverPathSecret: mocks.rotateReceiverPathSecret
  },
  callbackEventService: { sendDashboardTestEvent: mocks.sendDashboardTestEvent },
  enrichCallbackInstanceTriggers: vi.fn(),
  enrichSingleCallbackInstanceTriggers: vi.fn()
}));
vi.mock('@metorial/presenters', () => {
  let presenter = {
    introspect: () => ({
      name: 'Test',
      object: {
        type: 'object',
        optional: false,
        nullable: false,
        examples: [],
        properties: {}
      }
    }),
    present: ({ callbackInstance, callbackEvent, receiverPathSecret }: any) =>
      receiverPathSecret
        ? {
            object: 'callback.receiver_path_secret',
            id: receiverPathSecret.pathSecret.id,
            generation: receiverPathSecret.pathSecret.generation,
            value: receiverPathSecret.plaintext,
            webhook_url: receiverPathSecret.webhookUrl
          }
        : (callbackEvent ?? callbackInstance)
  };
  return {
    callbackPresenter: presenter,
    callbackEventPresenter: presenter,
    callbackInstancePresenter: presenter,
    callbackReceiverPathSecretPresenter: presenter
  };
});
vi.mock('@metorial/db', () => ({}));
vi.mock('@metorial/config', () => ({}));

import { callbackInstanceController } from './callbackInstance';

let organization = { id: 'org_1' };
let project = { id: 'prj_1', organization };
let instance = { id: 'ins_1', organization, project };
let actor = { id: 'act_1' };
let callback = { id: 'clb_1' };
let callbackInstance = { id: 'cbi_1', callbackOid: 1n };
let secretResult = {
  pathSecret: {
    id: 'sec_path_1',
    generation: 1,
    createdAt: new Date('2026-08-21T12:00:00.000Z'),
    updatedAt: new Date('2026-08-21T12:00:00.000Z')
  },
  plaintext: 'metorial_callback_path_once',
  webhookUrl: 'https://hooks.example.test/receiver/str_1/metorial_callback_path_once'
};

let request = (overrides: Record<string, unknown> = {}) =>
  ({
    body: {},
    url: '/dashboard/instances/ins_1/callbacks/clb_1/instances/cbi_1/security/path-secret',
    auth: { type: 'user', machineAccess: false },
    context: { ip: '192.0.2.10', ua: 'dashboard-test' },
    requestId: 'request_1',
    apiVersion: 'mt_2025_01_01_dashboard',
    query: {},
    params: {
      instanceId: instance.id,
      callbackId: callback.id,
      callbackInstanceId: callbackInstance.id
    },
    headers: {},
    sharedMiddlewareMemo: new Map(),
    ...overrides
  }) as any;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.accessInstance.mockResolvedValue({ instance, organization, project, actor });
  mocks.checkAccess.mockResolvedValue(undefined);
  mocks.checkTargetAccess.mockResolvedValue(undefined);
  mocks.getCallback.mockResolvedValue(callback);
  mocks.getCallbackInstance.mockResolvedValue(callbackInstance);
  mocks.sendDashboardTestEvent.mockResolvedValue({
    id: 'callback_event_1',
    callbackId: callback.id,
    callbackInstanceId: callbackInstance.id,
    type: 'dashboard.test'
  });
  mocks.createReceiverPathSecret.mockResolvedValue(secretResult);
  mocks.rotateReceiverPathSecret.mockResolvedValue({
    ...secretResult,
    pathSecret: { ...secretResult.pathSecret, generation: 2 }
  });
});

describe('callback receiver path-secret dashboard boundary', () => {
  it.each([
    ['createReceiverPathSecret', mocks.createReceiverPathSecret, 1],
    ['rotateReceiverPathSecret', mocks.rotateReceiverPathSecret, 2]
  ] as const)(
    '%s is ownership-scoped, confidential, and returns plaintext once',
    async (handlerName, service, generation) => {
      let handler = (callbackInstanceController.handlers as any)[handlerName];
      let result = await handler.run(request(), {});

      expect(mocks.getCallback).toHaveBeenCalledWith({
        instance,
        callbackId: callback.id,
        allowDeleted: false
      });
      expect(mocks.getCallbackInstance).toHaveBeenCalledWith({
        instance,
        callbackId: callback.id,
        callbackInstanceId: callbackInstance.id
      });
      expect(service).toHaveBeenCalledWith({ instance, callback, callbackInstance });
      expect(result.response).toMatchObject({
        object: 'callback.receiver_path_secret',
        generation,
        value: 'metorial_callback_path_once'
      });
    }
  );

  it('declares only create and immediate rotate receiver-secret routes', () => {
    let source = readFileSync(new URL('./callbackInstance.ts', import.meta.url), 'utf8');
    for (let handlerName of ['createReceiverPathSecret', 'rotateReceiverPathSecret']) {
      expect(source).toMatch(
        new RegExp(`${handlerName}:[\\s\\S]*?confidential: true[\\s\\S]*?\\.use\\(`)
      );
    }

    expect(Object.keys(callbackInstanceController.handlers)).toContain('sendTestEvent');
    expect(Object.keys(callbackInstanceController.handlers)).not.toEqual(
      expect.arrayContaining([
        'getReceiverPathSecret',
        'revokeReceiverPathSecret',
        'revokeAllReceiverPathSecrets',
        'consumeReceiverPathSecretReceipt',
        'reencryptReceiverPathSecret'
      ])
    );
    expect(source).not.toMatch(/grace_period|receipt_token|secret_version/i);
  });

  it('sends one confidential dashboard test event with a server-owned idempotency ID', async () => {
    let handler = callbackInstanceController.handlers.sendTestEvent as any;
    let result = await handler.run(
      request({ body: { event_type: 'dashboard.test', payload: { ok: true } } }),
      {}
    );

    expect(mocks.sendDashboardTestEvent).toHaveBeenCalledTimes(1);
    expect(mocks.sendDashboardTestEvent).toHaveBeenCalledWith({
      instance,
      callbackId: callback.id,
      callbackInstanceId: callbackInstance.id,
      eventId: expect.stringMatching(/^dashboard_test:[0-9a-f-]{36}$/),
      input: {
        eventType: 'dashboard.test',
        payloadJson: '{"ok":true}'
      }
    });
    expect(result.response).toMatchObject({
      id: 'callback_event_1',
      callbackId: callback.id,
      callbackInstanceId: callbackInstance.id
    });

    let source = readFileSync(new URL('./callbackInstance.ts', import.meta.url), 'utf8');
    expect(source).toMatch(
      /sendTestEvent:[\s\S]*?confidential: CALLBACK_DASHBOARD_TEST_EVENT\.confidential/
    );
  });

  it.each([
    ['machine token', { type: 'machine', restrictions: { type: 'instance', instance } }],
    ['API token', { type: 'api_key', machineAccess: false }],
    ['machine-backed user token', { type: 'user', machineAccess: true }]
  ])('rejects a %s before callback ownership lookup', async (_label, auth) => {
    let handler = callbackInstanceController.handlers.createReceiverPathSecret as any;

    await expect(handler.run(request({ auth }), {})).rejects.toMatchObject({
      data: { status: 403 }
    });
    expect(mocks.getCallback).not.toHaveBeenCalled();
    expect(mocks.createReceiverPathSecret).not.toHaveBeenCalled();
  });

  it('rejects machine authentication before a dashboard test-event lookup', async () => {
    let handler = callbackInstanceController.handlers.sendTestEvent as any;

    await expect(
      handler.run(
        request({
          auth: { type: 'machine', restrictions: { type: 'instance', instance } },
          body: { event_type: 'dashboard.test', payload: { ok: true } }
        }),
        {}
      )
    ).rejects.toMatchObject({ data: { status: 403 } });
    expect(mocks.getCallback).not.toHaveBeenCalled();
    expect(mocks.sendDashboardTestEvent).not.toHaveBeenCalled();
  });
});
