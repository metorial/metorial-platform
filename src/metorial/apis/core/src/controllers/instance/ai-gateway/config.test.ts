import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { declarePresenter } from '@metorial/presenter';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Controller,
  Group,
  Handler,
  Path
} from '../../../../../../../platform/packages/rest/src/controller';
import { introspectApi } from '../../../../../../../platform/packages/rest/src/introspect';
import { v1AiGatewayConfigPresenter } from '../../../../../../presenters/src/implementation/aiGateway/config';
import { aiGatewayConfigType } from '../../../../../../presenters/src/types';

let mocks = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  checkAccess: vi.fn(),
  checkTargetAccess: vi.fn(),
  getFlags: vi.fn()
}));

vi.mock('@metorial/rest', () => ({ Controller, Group, Handler, Path }));

vi.mock('@metorial/module-ai-gateway', () => ({
  aiGatewayConfigService: { get: mocks.get, update: mocks.update }
}));
vi.mock('@metorial/module-access', () => ({
  accessService: { checkAccess: mocks.checkAccess, checkTargetAccess: mocks.checkTargetAccess }
}));
vi.mock('@metorial/module-flags', () => ({
  flagService: { getFlags: mocks.getFlags },
  isFlagEnabled: (flag: unknown) => flag === true,
  getFlagDisabledReason: () => undefined
}));
vi.mock('../../../middleware/apiGroup', () => ({ apiGroup: Group.create() }));
vi.mock('../../../middleware/instanceGroup', () => ({
  instanceGroup: Group.create(),
  instancePath: (path: string, sdkPath: string) => [
    Path(`/${path}`, sdkPath),
    Path(`/instances/:instanceId/${path}`, `management.instance.${sdkPath}`),
    Path(`/dashboard/instances/:instanceId/${path}`, `dashboard.instance.${sdkPath}`)
  ]
}));
vi.mock('@metorial/presenters', () => ({
  aiGatewayConfigPresenter: declarePresenter(aiGatewayConfigType, {
    mt_2025_01_01_dashboard: v1AiGatewayConfigPresenter,
    mt_2026_01_01_magnetar: v1AiGatewayConfigPresenter
  })
}));

let { aiGatewayConfigController } = await import('./config');

let configHandler = (method: keyof typeof aiGatewayConfigController.handlers) => {
  let handler = aiGatewayConfigController.handlers[method];
  if (!(handler instanceof Handler)) throw new Error('Expected a config handler');

  return handler;
};

let instance = { oid: 7n, id: 'ins_1', project: { oid: 8n }, organization: { oid: 9n } };
let auditScope = { organizationOid: 9n };
let context = {
  instance,
  organization: instance.organization,
  project: instance.project,
  auditScope
};

let restrictedSince = new Date('2026-11-19T08:00:00Z');

let config = {
  instance: {
    object: 'ai_gateway#instance',
    id: 'gwi_1',
    ref: 'ins_1',
    name: 'Production',
    organizationId: 'gwo_1',
    project: { id: 'gwp_1', ref: 'prj_1' },
    logRetentionDays: 30,
    settings: {
      contentLogging: { enabled: true, retentionDays: 14 },
      metorialProviderEnabled: true,
      fallbacksEnabled: false,
      zdrRequired: true
    },
    limits: [{ metric: 'spend_usd', amount: 50, interval: '1d' }],
    archivedAt: null,
    createdAt: new Date('2026-11-01T10:00:00Z'),
    updatedAt: new Date('2026-11-20T10:00:00Z')
  },
  project: {
    object: 'ai_gateway#project',
    id: 'gwp_1',
    ref: 'prj_1',
    name: 'Project',
    organizationId: 'gwo_1',
    platformLimits: [{ metric: 'metorial_spend_usd', amount: 5, intervalSeconds: 86400 }],
    platformLimitsSyncedAt: new Date('2026-11-19T08:00:00Z'),
    disabled: null,
    billingRestriction: { reason: 'Out of credits.', since: restrictedSince },
    archivedAt: null,
    createdAt: new Date('2026-11-01T10:00:00Z'),
    updatedAt: new Date('2026-11-19T08:00:00Z')
  }
};

let request = (input: { body?: Record<string, unknown> }) =>
  ({
    body: input.body ?? {},
    query: {},
    apiVersion: 'mt_2026_01_01_magnetar',
    auth: { type: 'machine' },
    params: {},
    sharedMiddlewareMemo: new Map()
  }) as any;

let presented = async (result: { response: any }) =>
  await result.response({ apiVersion: 'mt_2026_01_01_magnetar' }).run();

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getFlags.mockResolvedValue({ 'ai-gateway-enabled': true, 'paid-ai-gateway': true });
  mocks.get.mockResolvedValue(config);
  mocks.update.mockResolvedValue(config);
});

describe('ai gateway config', () => {
  it('presents the resolved settings symmetrically with the input', async () => {
    let result = await configHandler('get').run(request({}), context);

    expect(mocks.get).toHaveBeenCalledWith({ instance });
    expect(await presented(result)).toEqual({
      object: 'ai_gateway.config',
      log_retention_days: 30,
      settings: {
        content_logging: { enabled: true, retention_days: 14 },
        metorial_provider: { enabled: true },
        fallbacks: { enabled: false },
        zero_data_retention: { required: true }
      },
      limits: [{ metric: 'spend_usd', amount: 50, interval: '1d' }],
      plan_limits: [{ metric: 'metorial_spend_usd', amount: 5, interval_seconds: 86400 }],
      disabled: null,
      billing_restriction: { reason: 'Out of credits.', since: restrictedSince },
      updated_at: config.instance.updatedAt
    });
    expect(mocks.checkAccess).toHaveBeenCalledWith(
      expect.objectContaining({ possibleScopes: ['instance.ai_gateway:read'] })
    );
  });

  it('maps snake_case settings to the gateway input', async () => {
    await configHandler('update').run(
      request({
        body: {
          log_retention_days: 30,
          settings: {
            content_logging: { enabled: true, retention_days: 14 },
            zero_data_retention: { required: true }
          },
          limits: [{ metric: 'spend_usd', amount: 50, interval: '1d' }]
        }
      }),
      context
    );

    expect(mocks.update).toHaveBeenCalledWith({
      instance,
      auditScope,
      input: {
        logRetentionDays: 30,
        settings: {
          contentLogging: { enabled: true, retentionDays: 14 },
          metorialProvider: undefined,
          fallbacks: undefined,
          zeroDataRetention: { required: true }
        },
        limits: [{ metric: 'spend_usd', amount: 50, interval: '1d' }]
      }
    });
  });

  it('leaves settings and limits untouched when omitted', async () => {
    await configHandler('update').run(request({ body: { log_retention_days: 7 } }), context);

    expect(mocks.update).toHaveBeenCalledWith({
      instance,
      auditScope,
      input: { logRetentionDays: 7, settings: undefined, limits: undefined }
    });
  });

  it('changes a single field of a setting', async () => {
    await configHandler('update').run(
      request({ body: { settings: { content_logging: { retention_days: 14 } } } }),
      context
    );

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          settings: {
            contentLogging: { enabled: undefined, retentionDays: 14 },
            metorialProvider: undefined,
            fallbacks: undefined,
            zeroDataRetention: undefined
          }
        })
      })
    );
  });

  it.each([
    [{ log_retention_days: 401 }],
    [{ settings: { content_logging: { enabled: true, retention_days: 91 } } }]
  ])('rejects an invalid body: %o', async body => {
    await expect(
      configHandler('update').run(request({ body }), context)
    ).rejects.toMatchObject({
      data: { status: 400 }
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('requires the paid AI gateway flag', async () => {
    mocks.getFlags.mockResolvedValue({ 'ai-gateway-enabled': true, 'paid-ai-gateway': false });

    await expect(configHandler('get').run(request({}), context)).rejects.toMatchObject({
      data: { status: 402 }
    });
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('rejects callers without write access', async () => {
    mocks.checkAccess.mockRejectedValue(new ServiceError(forbiddenError()));

    await expect(
      configHandler('update').run(request({ body: { log_retention_days: 7 } }), context)
    ).rejects.toMatchObject({ data: { status: 403 } });
    expect(mocks.checkAccess).toHaveBeenCalledWith(
      expect.objectContaining({ possibleScopes: ['instance.ai_gateway:write'] })
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe('ai gateway config introspection', () => {
  let introspection = introspectApi({
    rootController: Controller.create(
      { name: 'Test', description: 'Test' },
      { config: aiGatewayConfigController }
    ),
    displayVersion: 'mt_2026_01_01_magnetar',
    version: 'mt_2026_01_01_magnetar',
    isCurrent: true
  });

  it('updates with PATCH under the instance aliases', () => {
    let update = introspection.endpoints.find(
      endpoint => endpoint.path.sdkPath == 'aiGateway.config.update'
    )!;

    expect(update.method).toBe('patch');
    expect(update.allPaths.map((path: { path: string }) => path.path)).toEqual([
      '/ai-gateway/config',
      '/instances/:instanceId/ai-gateway/config',
      '/dashboard/instances/:instanceId/ai-gateway/config'
    ]);
  });
});
