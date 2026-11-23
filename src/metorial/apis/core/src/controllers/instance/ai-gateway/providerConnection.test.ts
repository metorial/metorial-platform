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
import { v1AiGatewayProviderConnectionPresenter } from '../../../../../../presenters/src/implementation/aiGateway/providerConnection';
import { aiGatewayProviderConnectionType } from '../../../../../../presenters/src/types';

let mocks = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  check: vi.fn(),
  setEnabled: vi.fn(),
  archive: vi.fn(),
  checkAccess: vi.fn(),
  checkTargetAccess: vi.fn(),
  getFlags: vi.fn()
}));

vi.mock('@metorial/rest', () => ({ Controller, Group, Handler, Path }));

vi.mock('@metorial/module-ai-gateway', () => ({
  aiGatewayProviderConnectionService: {
    get: mocks.get,
    list: mocks.list,
    create: mocks.create,
    update: mocks.update,
    check: mocks.check,
    setEnabled: mocks.setEnabled,
    archive: mocks.archive
  }
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
  aiGatewayProviderConnectionPresenter: declarePresenter(aiGatewayProviderConnectionType, {
    mt_2025_01_01_dashboard: v1AiGatewayProviderConnectionPresenter,
    mt_2026_01_01_magnetar: v1AiGatewayProviderConnectionPresenter
  })
}));

let { aiGatewayProviderConnectionController } = await import('./providerConnection');

let connectionHandler = (
  method: keyof typeof aiGatewayProviderConnectionController.handlers
) => {
  let handler = aiGatewayProviderConnectionController.handlers[method];
  if (!(handler instanceof Handler)) throw new Error('Expected a provider connection handler');

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

let gatewayPricing = {
  currency: 'USD',
  text: {
    input: 2.5,
    output: 10,
    cacheRead: 1.25,
    cacheWrite: [{ ttl: '5m', price: 3 }],
    reasoning: null
  },
  image: null,
  audio: null,
  video: null,
  contextTiers: [{ minInputTokens: 200000, input: 5, output: 15, cacheRead: null }],
  units: [{ modality: 'image', direction: 'output', unit: 'image', price: 0.04 }],
  webSearchPer1k: 10
};

let connection = {
  object: 'ai_gateway#provider_connection',
  id: 'apcn_1',
  name: 'OpenAI production',
  description: null,
  priority: 10,
  provider: { id: 'aprv_1', slug: 'openai', name: 'OpenAI' },
  organizationId: 'org_1',
  instance: { id: 'ains_1', ref: 'ins_1', projectId: 'aprj_1' },
  config: {},
  features: { zdr: true },
  pricingOverride: { multiplier: 0.8, models: { 'openai/gpt-5': gatewayPricing } },
  credentialHint: '…abcd',
  status: 'valid',
  statusMessage: null,
  consecutiveFailures: 0,
  lastCheckedAt: new Date('2026-11-20T10:00:00Z'),
  lastValidAt: new Date('2026-11-20T10:00:00Z'),
  nextCheckAt: new Date('2026-11-21T10:00:00Z'),
  archivedAt: null,
  createdAt: new Date('2026-11-20T09:00:00Z'),
  updatedAt: new Date('2026-11-20T10:00:00Z')
};

let publicPricing = {
  currency: 'USD',
  text: {
    input: 2.5,
    output: 10,
    cache_read: 1.25,
    cache_write: [{ ttl: '5m', price: 3 }],
    reasoning: null
  },
  image: null,
  audio: null,
  video: null,
  context_tiers: [{ min_input_tokens: 200000, input: 5, output: 15, cache_read: null }],
  units: [{ modality: 'image', direction: 'output', unit: 'image', price: 0.04 }],
  web_search_per_1k: 10
};

let request = (input: { query?: Record<string, unknown>; body?: Record<string, unknown> }) =>
  ({
    body: input.body ?? {},
    query: input.query ?? {},
    apiVersion: 'mt_2026_01_01_magnetar',
    auth: { type: 'machine' },
    params: { connectionId: 'apcn_1' },
    sharedMiddlewareMemo: new Map()
  }) as any;

let presented = async (result: { response: any }) =>
  await result.response({ apiVersion: 'mt_2026_01_01_magnetar' }).run();

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getFlags.mockResolvedValue({ 'ai-gateway-enabled': true, 'paid-ai-gateway': true });
  mocks.get.mockResolvedValue(connection);
  mocks.list.mockReturnValue({
    run: vi.fn().mockResolvedValue({
      items: [connection],
      pagination: { hasMoreBefore: false, hasMoreAfter: false }
    })
  });
  mocks.create.mockResolvedValue(connection);
  mocks.update.mockResolvedValue(connection);
  mocks.check.mockResolvedValue(connection);
  mocks.setEnabled.mockResolvedValue({ ...connection, status: 'disabled', nextCheckAt: null });
  mocks.archive.mockResolvedValue({
    ...connection,
    archivedAt: new Date('2026-11-20T12:00:00Z')
  });
});

describe('ai gateway provider connections', () => {
  it('maps the public body to the gateway input when creating', async () => {
    await connectionHandler('create').run(
      request({
        body: {
          provider: 'openai',
          name: 'OpenAI production',
          priority: 10,
          credentials: { apiKey: 'sk-secret-abcd' },
          features: { zdr: true },
          pricing_override: { multiplier: 0.8, models: { 'openai/gpt-5': publicPricing } }
        }
      }),
      context
    );

    expect(mocks.create).toHaveBeenCalledWith({
      instance,
      auditScope,
      input: {
        providerSlug: 'openai',
        name: 'OpenAI production',
        description: undefined,
        priority: 10,
        credentials: { apiKey: 'sk-secret-abcd' },
        config: undefined,
        features: { zdr: true },
        pricingOverride: { multiplier: 0.8, models: { 'openai/gpt-5': gatewayPricing } }
      }
    });
    expect(mocks.checkAccess).toHaveBeenCalledWith(
      expect.objectContaining({ possibleScopes: ['instance.ai_gateway:write'] })
    );
  });

  it('fills omitted pricing fields with their empty values', async () => {
    await connectionHandler('update').run(
      request({
        body: {
          pricing_override: {
            models: { 'openai/gpt-5': { currency: 'USD', text: { input: 1, output: 4 } } }
          }
        }
      }),
      context
    );

    expect(mocks.update.mock.calls[0]![0].input.pricingOverride).toEqual({
      multiplier: undefined,
      models: {
        'openai/gpt-5': {
          currency: 'USD',
          text: { input: 1, output: 4, cacheRead: null, cacheWrite: [], reasoning: null },
          image: null,
          audio: null,
          video: null,
          contextTiers: [],
          units: [],
          webSearchPer1k: null
        }
      }
    });
  });

  it('removes the pricing override with null and leaves omitted fields unchanged', async () => {
    await connectionHandler('update').run(
      request({ body: { pricing_override: null, credentials: { apiKey: 'sk-new' } } }),
      context
    );

    expect(mocks.update).toHaveBeenCalledWith({
      instance,
      connection,
      auditScope,
      input: {
        name: undefined,
        description: undefined,
        priority: undefined,
        credentials: { apiKey: 'sk-new' },
        config: undefined,
        features: undefined,
        pricingOverride: null
      }
    });
  });

  it('presents the connection in snake case without credentials or internal refs', async () => {
    let result = await connectionHandler('get').run(request({}), context);
    let body = await presented(result);

    expect(mocks.get).toHaveBeenCalledWith({ instance, connectionId: 'apcn_1' });
    expect(body).toEqual({
      object: 'ai_gateway.provider_connection',
      id: 'apcn_1',
      name: 'OpenAI production',
      description: null,
      priority: 10,
      provider: { id: 'aprv_1', slug: 'openai', name: 'OpenAI' },
      config: {},
      features: { zdr: true },
      pricing_override: {
        multiplier: 0.8,
        models: { 'openai/gpt-5': { ...publicPricing, conditions: [] } }
      },
      credential_hint: '…abcd',
      status: 'valid',
      status_message: null,
      consecutive_failures: 0,
      last_checked_at: connection.lastCheckedAt,
      last_valid_at: connection.lastValidAt,
      next_check_at: connection.nextCheckAt,
      deleted_at: null,
      created_at: connection.createdAt,
      updated_at: connection.updatedAt
    });
  });

  it('presents a connection without features or pricing override', async () => {
    mocks.get.mockResolvedValue({ ...connection, features: {}, pricingOverride: null });

    let body = await presented(await connectionHandler('get').run(request({}), context));

    expect(body).toMatchObject({ features: { zdr: false }, pricing_override: null });
  });

  it('filters the list by provider and one or many statuses', async () => {
    await connectionHandler('list').run(
      request({ query: { provider: 'openai', status: 'invalid' } }),
      context
    );
    await connectionHandler('list').run(
      request({ query: { status: ['valid', 'pending'] } }),
      context
    );

    expect(mocks.list).toHaveBeenNthCalledWith(1, {
      instance,
      providerSlug: 'openai',
      statuses: ['invalid']
    });
    expect(mocks.list).toHaveBeenNthCalledWith(2, {
      instance,
      providerSlug: undefined,
      statuses: ['valid', 'pending']
    });
  });

  it('rejects an unknown status filter', async () => {
    await expect(
      connectionHandler('list').run(request({ query: { status: 'broken' } }), context)
    ).rejects.toMatchObject({ data: { status: 400 } });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('enables and disables the loaded connection', async () => {
    await connectionHandler('enable').run(request({}), context);
    await connectionHandler('disable').run(request({}), context);

    expect(mocks.setEnabled).toHaveBeenNthCalledWith(1, {
      instance,
      connection,
      auditScope,
      enabled: true
    });
    expect(mocks.setEnabled).toHaveBeenNthCalledWith(2, {
      instance,
      connection,
      auditScope,
      enabled: false
    });
  });

  it('checks the loaded connection', async () => {
    await connectionHandler('check').run(request({}), context);

    expect(mocks.check).toHaveBeenCalledWith({ instance, connection });
  });

  it('returns the deleted connection with deleted_at set', async () => {
    let result = await connectionHandler('delete').run(request({}), context);

    expect(mocks.archive).toHaveBeenCalledWith({ instance, connection, auditScope });
    expect(await presented(result)).toMatchObject({
      id: 'apcn_1',
      deleted_at: new Date('2026-11-20T12:00:00Z')
    });
  });

  it.each([
    [{ 'ai-gateway-enabled': false, 'paid-ai-gateway': true }, 403],
    [{ 'ai-gateway-enabled': true, 'paid-ai-gateway': false }, 402]
  ])('enforces the AI gateway flags: %o', async (flags, status) => {
    mocks.getFlags.mockResolvedValue(flags);

    await expect(connectionHandler('list').run(request({}), context)).rejects.toMatchObject({
      data: { status }
    });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('rejects callers without write access', async () => {
    mocks.checkAccess.mockRejectedValue(new ServiceError(forbiddenError()));

    await expect(connectionHandler('disable').run(request({}), context)).rejects.toMatchObject(
      {
        data: { status: 403 }
      }
    );
    expect(mocks.setEnabled).not.toHaveBeenCalled();
  });
});

describe('ai gateway provider connection introspection', () => {
  let introspection = introspectApi({
    rootController: Controller.create(
      { name: 'Test', description: 'Test' },
      { providerConnections: aiGatewayProviderConnectionController }
    ),
    displayVersion: 'mt_2026_01_01_magnetar',
    version: 'mt_2026_01_01_magnetar',
    isCurrent: true
  });

  it('exposes every route under the instance aliases', () => {
    let remove = introspection.endpoints.find(
      endpoint => endpoint.path.sdkPath == 'aiGateway.providerConnections.delete'
    )!;

    expect(remove.method).toBe('delete');
    expect(remove.allPaths.map((path: { path: string }) => path.path)).toEqual([
      '/ai-gateway/provider-connections/:connectionId',
      '/instances/:instanceId/ai-gateway/provider-connections/:connectionId',
      '/dashboard/instances/:instanceId/ai-gateway/provider-connections/:connectionId'
    ]);
  });
});
