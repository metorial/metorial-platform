import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  accessInstance: vi.fn(),
  checkAccess: vi.fn(),
  checkTargetAccess: vi.fn(),
  getCallbackDestinationById: vi.fn(),
  rotateSigningSecret: vi.fn()
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
vi.mock('@metorial-subspace/module-callback', () => ({
  callbackDestinationService: {
    getCallbackDestinationById: mocks.getCallbackDestinationById,
    enrichCallbackDestination: vi.fn(),
    enrichCallbackDestinations: vi.fn(),
    listCallbackDestinations: vi.fn(),
    createCallbackDestination: vi.fn(),
    updateCallbackDestination: vi.fn(),
    archiveCallbackDestination: vi.fn(),
    rotateSigningSecret: mocks.rotateSigningSecret
  }
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
    present: ({ callbackDestination, callbackDestinationSigningSecret }: any) =>
      callbackDestinationSigningSecret ?? callbackDestination
  };
  return {
    callbackDestinationPresenter: presenter,
    callbackDestinationSigningSecretPresenter: presenter
  };
});
vi.mock('@metorial/db', () => ({}));
vi.mock('@metorial/config', () => ({}));

import { callbackDestinationController } from './callbackDestination';

let organization = { id: 'org_1' };
let project = { id: 'prj_1', organization };
let instance = { id: 'ins_1', organization, project };
let actor = { id: 'act_1' };
let callbackDestination = { id: 'cbd_1' };
let rotated = {
  callbackDestinationId: callbackDestination.id,
  signingSecret: 'metorial_whsec_rotated',
  rotatedAt: new Date('2026-08-21T12:00:00.000Z')
};

let request = (overrides: Record<string, unknown> = {}) =>
  ({
    body: {},
    url: '/dashboard/instances/ins_1/callback-destinations/cbd_1/security/signing-secret/rotate',
    auth: { type: 'user', machineAccess: false },
    context: { ip: '192.0.2.10', ua: 'dashboard-test' },
    requestId: 'request_1',
    apiVersion: 'mt_2025_01_01_dashboard',
    query: {},
    params: {
      instanceId: instance.id,
      callbackDestinationId: callbackDestination.id
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
  mocks.getCallbackDestinationById.mockResolvedValue(callbackDestination);
  mocks.rotateSigningSecret.mockResolvedValue(rotated);
});

describe('callback destination signing-secret dashboard boundary', () => {
  it('authenticates, scopes ownership, and returns plaintext from immediate rotation once', async () => {
    let handler = callbackDestinationController.handlers.rotateSigningSecret as any;
    let result = await handler.run(request(), {});

    expect(mocks.getCallbackDestinationById).toHaveBeenCalledWith({
      instance,
      callbackDestinationId: callbackDestination.id
    });
    expect(mocks.rotateSigningSecret).toHaveBeenCalledWith({
      instance,
      callbackDestination
    });
    expect(result.response).toEqual(rotated);

    let source = readFileSync(new URL('./callbackDestination.ts', import.meta.url), 'utf8');
    expect(source).toMatch(
      /rotateSigningSecret:[\s\S]*?confidential: true[\s\S]*?callbackDestinationSigningSecretPresenter/
    );
    expect(source).not.toMatch(/grace_period|receipt_token|secret_version|revoke/i);
  });

  it('rejects machine authentication before destination lookup', async () => {
    let handler = callbackDestinationController.handlers.rotateSigningSecret as any;

    await expect(
      handler.run(
        request({ auth: { type: 'machine', restrictions: { type: 'instance', instance } } }),
        {}
      )
    ).rejects.toMatchObject({ data: { status: 403 } });
    expect(mocks.getCallbackDestinationById).not.toHaveBeenCalled();
    expect(mocks.rotateSigningSecret).not.toHaveBeenCalled();
  });
});
