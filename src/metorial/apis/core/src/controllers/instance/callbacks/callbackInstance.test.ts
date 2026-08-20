import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  accessInstance: vi.fn(),
  checkAccess: vi.fn(),
  checkTargetAccess: vi.fn(),
  getCallback: vi.fn(),
  getCallbackInstance: vi.fn(),
  beginGithubManifest: vi.fn(),
  sendDashboardTestEvent: vi.fn(),
  createReceiverPathSecret: vi.fn(),
  rotateReceiverPathSecret: vi.fn(),
  revokeReceiverPathSecret: vi.fn(),
  consumeReceiverPathSecretReceipt: vi.fn()
}));

vi.mock('@metorial/module-access', () => ({
  accessService: {
    accessInstance: mocks.accessInstance,
    checkAccess: mocks.checkAccess,
    checkTargetAccess: mocks.checkTargetAccess
  }
}));

vi.mock('@metorial/module-subspace', () => ({
  subspaceCallbackService: {
    get: mocks.getCallback,
    sendDashboardTestEvent: mocks.sendDashboardTestEvent,
    createReceiverPathSecret: mocks.createReceiverPathSecret,
    rotateReceiverPathSecret: mocks.rotateReceiverPathSecret,
    revokeReceiverPathSecret: mocks.revokeReceiverPathSecret,
    consumeReceiverPathSecretReceipt: mocks.consumeReceiverPathSecretReceipt
  },
  subspaceCallbackInstanceService: {
    get: mocks.getCallbackInstance
  },
  subspaceProvisionedTenantAppService: {
    beginGithubManifest: mocks.beginGithubManifest
  }
}));

vi.mock('@metorial/consumer-auth', () => ({
  getConsumerAccessContextForConsumerProfile: vi.fn()
}));

vi.mock('@metorial/module-consumer', () => ({
  consumerProfileService: {}
}));

vi.mock('@metorial/module-resource-tenant', () => ({
  resourceActorService: {}
}));

vi.mock('@metorial/db', () => ({}));
vi.mock('@metorial/config', () => ({}));

vi.mock('../../../presenters', () => {
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
    present: ({
      callbackEvent,
      callback,
      callbackInstance,
      callbackSecretMutation,
      callbackSecretConsumption,
      setup
    }: any) => {
      if (callbackEvent) {
        return {
          object: 'callback.event',
          id: callbackEvent.id,
          source_id: callbackEvent.sourceId
        };
      }
      if (setup) {
        return {
          object: 'callback.github_manifest_setup',
          redirect_url: setup.redirectUrl,
          expires_at: setup.expiresAt,
          generation: setup.generation
        };
      }
      return (
        callback ?? callbackInstance ?? callbackSecretMutation ?? callbackSecretConsumption
      );
    }
  };

  return {
    callbackEventPresenter: presenter,
    callbackInstancePresenter: presenter,
    callbackPresenter: presenter,
    callbackSecretMutationPresenter: presenter,
    callbackSecretConsumptionPresenter: presenter,
    callbackGithubManifestSetupPresenter: presenter
  };
});

import { callbackInstanceController } from './callbackInstance';
import {
  CALLBACK_DASHBOARD_TEST_EVENT,
  sendDashboardTestCallbackEvent
} from './callbackInstanceTestEvent';

let organization = { id: 'org_authorized' };
let project = { id: 'prj_authorized', organization };
let instance = { id: 'ins_authorized', organization, project };
let actor = { id: 'organization-actor-authorized' };
let callback = { id: 'clb_authorized' };
let callbackEvent = {
  id: 'cbe_test',
  type: 'dashboard.test',
  sourceId: 'dashboard_test',
  triggerKey: 'dashboard_test',
  input: { test: true },
  output: { test: true },
  status: 'succeeded',
  error: null,
  deliveryStatus: 'pending',
  callbackId: callback.id,
  callbackInstanceId: 'cbi_authorized',
  createdAt: new Date('2026-08-15T08:00:00.000Z')
};

let request = (overrides: Record<string, unknown> = {}) =>
  ({
    body: { event_type: 'dashboard.test', payload: { test: true } },
    url: '/dashboard/instances/ins_authorized/callbacks/clb_authorized/instances/cbi_authorized/test-event',
    auth: { type: 'user', machineAccess: false },
    context: { ip: '192.0.2.10', ua: 'dashboard-test' },
    requestId: 'request_authorized',
    apiVersion: 'mt_2025_01_01_dashboard',
    query: {},
    params: {
      instanceId: instance.id,
      callbackId: callback.id,
      callbackInstanceId: 'cbi_authorized'
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
  mocks.getCallbackInstance.mockResolvedValue({
    id: 'cbi_authorized',
    security: {
      provisionedApps: [
        {
          id: 'pta_github_byo',
          generation: 4,
          vendor: 'github',
          credentialOwnerType: 'byo'
        }
      ]
    }
  });
  mocks.beginGithubManifest.mockResolvedValue({
    redirectUrl: 'https://github.com/settings/apps/new?state=authorized',
    expiresAt: new Date('2026-08-15T09:00:00.000Z'),
    generation: 5
  });
  mocks.sendDashboardTestEvent.mockResolvedValue(callbackEvent);
  mocks.createReceiverPathSecret.mockResolvedValue({
    secret: { id: 'secret-1' },
    secretIssuanceReceipt: { id: 'receipt-1', token: 'one-time-token' },
    auditCorrelationId: 'correlation-create'
  });
  mocks.rotateReceiverPathSecret.mockResolvedValue({
    secret: { id: 'secret-2' },
    secretIssuanceReceipt: { id: 'receipt-2', token: 'one-time-token' },
    graceExpiresAt: new Date('2026-08-15T09:00:00.000Z'),
    auditCorrelationId: 'correlation-rotate'
  });
  mocks.revokeReceiverPathSecret.mockResolvedValue({
    secret: { id: 'secret-1', status: 'revoked' },
    auditCorrelationId: 'correlation-revoke'
  });
  mocks.consumeReceiverPathSecretReceipt.mockResolvedValue({
    plaintext: 'metorial_whpath_one_time',
    auditCorrelationId: 'correlation-consume'
  });
});

describe('callback receiver-secret dashboard boundary', () => {
  it.each([
    ['createReceiverPathSecret', {}, {}, mocks.createReceiverPathSecret, {}],
    [
      'rotateReceiverPathSecret',
      { grace_period_seconds: 120 },
      {},
      mocks.rotateReceiverPathSecret,
      { graceMs: 120_000 }
    ],
    [
      'revokeReceiverPathSecret',
      {},
      { secretId: 'secret-1' },
      mocks.revokeReceiverPathSecret,
      { secretId: 'secret-1' }
    ],
    [
      'consumeReceiverPathSecretReceipt',
      { receipt_token: 'caller-receipt-token' },
      { receiptId: 'receipt-1' },
      mocks.consumeReceiverPathSecretReceipt,
      { receiptId: 'receipt-1', receiptToken: 'caller-receipt-token' }
    ]
  ] as const)(
    '%s is confidential, ownership-scoped, and forwards only server-derived audit attribution',
    async (handlerName, body, params, service, operationInput) => {
      let handler = (callbackInstanceController.handlers as any)[handlerName];

      await handler.run(
        request({
          body,
          params: {
            instanceId: instance.id,
            callbackId: callback.id,
            callbackInstanceId: 'cbi_authorized',
            ...params
          }
        }),
        {}
      );

      expect(service).toHaveBeenCalledWith({
        instance,
        callbackId: callback.id,
        callbackInstanceId: 'cbi_authorized',
        organizationActor: actor,
        requestId: 'request_authorized',
        requestIp: '192.0.2.10',
        requestUserAgent: 'dashboard-test',
        ...operationInput
      });
      expect(service.mock.calls[0]![0]).not.toHaveProperty('trustedActorId');
      expect(service.mock.calls[0]![0]).not.toHaveProperty('auditMetadata');
    }
  );

  it('declares every receiver-secret route confidential', () => {
    let source = readFileSync(new URL('./callbackInstance.ts', import.meta.url), 'utf8');
    for (let handlerName of [
      'createReceiverPathSecret',
      'rotateReceiverPathSecret',
      'revokeReceiverPathSecret',
      'consumeReceiverPathSecretReceipt'
    ]) {
      expect(source).toMatch(
        new RegExp(`${handlerName}:[\\s\\S]*?confidential: true[\\s\\S]*?\\.use\\(`)
      );
    }
  });

  it('has no ordinary receiver-secret plaintext read handler', () => {
    expect(Object.keys(callbackInstanceController.handlers)).not.toEqual(
      expect.arrayContaining([
        'getReceiverPathSecret',
        'readReceiverPathSecret',
        'revealReceiverPathSecret'
      ])
    );
  });
});

describe('callback instance dashboard test event contract', () => {
  it('registers a confidential write endpoint', () => {
    expect(CALLBACK_DASHBOARD_TEST_EVENT).toEqual({
      route: 'callbacks/:callbackId/instances/:callbackInstanceId/test-event',
      sdkPath: 'callbacks.instances.sendTestEvent',
      scope: 'instance.callback:write',
      confidential: true
    });
  });

  it('generates one server-owned event ID per dashboard action before the RPC call', async () => {
    let sendSynthetic = vi.fn().mockResolvedValue({ id: 'cbe_test' });
    let generateEventId = vi.fn(() => 'dashboard_test:stable-action-id');

    await sendDashboardTestCallbackEvent(
      {
        instance,
        callbackId: callback.id,
        callbackInstanceId: 'cbi_authorized',
        eventType: 'dashboard.test',
        payload: { test: true }
      },
      { sendDashboardTestEvent: sendSynthetic },
      generateEventId
    );

    expect(generateEventId).toHaveBeenCalledOnce();
    expect(sendSynthetic).toHaveBeenCalledWith({
      instance,
      callbackId: callback.id,
      callbackInstanceId: 'cbi_authorized',
      eventId: 'dashboard_test:stable-action-id',
      eventType: 'dashboard.test',
      payloadJson: '{"test":true}'
    });
    expect(sendSynthetic.mock.calls[0]![0]).not.toHaveProperty('webhookUrl');
    expect(sendSynthetic.mock.calls[0]![0]).not.toHaveProperty('source');
  });

  it('creates distinct server-owned IDs for distinct dashboard actions', async () => {
    let sendSynthetic = vi.fn().mockResolvedValue({ id: 'cbe_test' });
    let action = {
      instance,
      callbackId: callback.id,
      callbackInstanceId: 'cbi_authorized',
      eventType: 'dashboard.test',
      payload: { test: true }
    };

    await sendDashboardTestCallbackEvent(action, {
      sendDashboardTestEvent: sendSynthetic
    });
    await sendDashboardTestCallbackEvent(action, {
      sendDashboardTestEvent: sendSynthetic
    });

    expect(sendSynthetic.mock.calls[0]![0].eventId).toMatch(/^dashboard_test:/);
    expect(sendSynthetic.mock.calls[1]![0].eventId).toMatch(/^dashboard_test:/);
    expect(sendSynthetic.mock.calls[0]![0].eventId).not.toBe(
      sendSynthetic.mock.calls[1]![0].eventId
    );
  });
});

describe('callback GitHub BYO manifest boundary', () => {
  let handler = callbackInstanceController.handlers.beginGithubManifest as any;
  let githubRequest = () =>
    request({
      body: {},
      params: {
        instanceId: instance.id,
        callbackId: callback.id,
        callbackInstanceId: 'cbi_authorized',
        provisionedTenantAppId: 'pta_github_byo'
      }
    });

  it('uses the owned app generation and returns only the authorized setup receipt', async () => {
    let result = await handler.run(githubRequest(), {});

    expect(mocks.getCallbackInstance).toHaveBeenCalledWith({
      instance,
      callbackId: callback.id,
      callbackInstanceId: 'cbi_authorized'
    });
    expect(mocks.beginGithubManifest).toHaveBeenCalledWith({
      instance,
      provisionedTenantAppId: 'pta_github_byo',
      expectedGeneration: 4
    });
    expect(result.response).toEqual({
      object: 'callback.github_manifest_setup',
      redirect_url: 'https://github.com/settings/apps/new?state=authorized',
      expires_at: new Date('2026-08-15T09:00:00.000Z'),
      generation: 5
    });
  });

  it.each([
    ['unknown app', []],
    [
      'managed credential owner',
      [
        {
          id: 'pta_github_byo',
          generation: 4,
          vendor: 'github',
          credentialOwnerType: 'managed'
        }
      ]
    ],
    [
      'non-GitHub vendor',
      [{ id: 'pta_github_byo', generation: 4, vendor: 'slack', credentialOwnerType: 'byo' }]
    ]
  ])('denies %s before creating setup state', async (_, provisionedApps) => {
    mocks.getCallbackInstance.mockResolvedValueOnce({
      id: 'cbi_authorized',
      security: { provisionedApps }
    });

    await expect(handler.run(githubRequest(), {})).rejects.toMatchObject({
      data: { code: 'github_manifest_setup_unavailable' }
    });
    expect(mocks.beginGithubManifest).not.toHaveBeenCalled();
  });
});

describe('callback instance production controller boundary', () => {
  let handler = callbackInstanceController.handlers.sendTestEvent as any;

  it('runs dashboard, ownership, scope, validation, and Subspace delegation', async () => {
    let result = await handler.run(request(), {});

    expect(mocks.getCallback).toHaveBeenCalledWith({ instance, callbackId: callback.id });
    expect(mocks.checkAccess).toHaveBeenCalledWith({
      authInfo: expect.objectContaining({ type: 'user', machineAccess: false }),
      possibleScopes: ['instance.callback:write'],
      fineGrainedPolicy: undefined
    });
    expect(mocks.checkTargetAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        instance,
        organization,
        project,
        possibleScopes: ['instance.callback:write']
      })
    );
    expect(mocks.sendDashboardTestEvent).toHaveBeenCalledWith({
      instance,
      callbackId: callback.id,
      callbackInstanceId: 'cbi_authorized',
      eventId: expect.stringMatching(/^dashboard_test:/),
      eventType: 'dashboard.test',
      payloadJson: '{"test":true}'
    });
    expect(result.response).toMatchObject({
      object: 'callback.event',
      id: callbackEvent.id,
      source_id: 'dashboard_test'
    });
  });

  it('rejects malformed input before authorization or Subspace calls', async () => {
    await expect(
      handler.run(request({ body: { event_type: 'dashboard.test' } }), {})
    ).rejects.toMatchObject({ data: { code: 'invalid_data' } });

    expect(mocks.accessInstance).not.toHaveBeenCalled();
    expect(mocks.getCallback).not.toHaveBeenCalled();
    expect(mocks.sendDashboardTestEvent).not.toHaveBeenCalled();
  });

  it.each([
    ['machine token', { type: 'machine', restrictions: { type: 'instance', instance } }],
    ['API token', { type: 'api_key', machineAccess: false }],
    ['machine-backed user token', { type: 'user', machineAccess: true }]
  ])('rejects a %s before callback ownership lookup', async (_, auth) => {
    await expect(handler.run(request({ auth }), {})).rejects.toMatchObject({
      data: { status: 403 }
    });

    expect(mocks.getCallback).not.toHaveBeenCalled();
    expect(mocks.checkAccess).not.toHaveBeenCalled();
    expect(mocks.sendDashboardTestEvent).not.toHaveBeenCalled();
  });

  it('fails closed when callback ownership resolution fails', async () => {
    mocks.getCallback.mockRejectedValue(new Error('callback not owned by instance'));

    await expect(handler.run(request(), {})).rejects.toThrow('callback not owned by instance');
    expect(mocks.checkAccess).not.toHaveBeenCalled();
    expect(mocks.sendDashboardTestEvent).not.toHaveBeenCalled();
  });

  it('fails closed when the write scope is denied', async () => {
    mocks.checkAccess.mockRejectedValue(new Error('scope denied'));

    await expect(handler.run(request(), {})).rejects.toThrow('scope denied');
    expect(mocks.sendDashboardTestEvent).not.toHaveBeenCalled();
  });
});
