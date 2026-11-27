import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { declarePresenter } from '@metorial/presenter';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Controller,
  Group,
  Handler,
  Path
} from '../../../../../../../../platform/packages/rest/src/controller';
import { introspectApi } from '../../../../../../../../platform/packages/rest/src/introspect';
import { v1AiGatewayRoutePreviewPresenter } from '../../../../../../../../platform/presenters/src/implementation/aiGateway/routing';
import { aiGatewayRoutePreviewType } from '../../../../../../../../platform/presenters/src/types';

let mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  checkAccess: vi.fn(),
  checkTargetAccess: vi.fn(),
  getFlags: vi.fn()
}));

vi.mock('@metorial/rest', () => ({ Controller, Group, Handler, Path }));

vi.mock('@metorial/module-ai-gateway', () => ({
  aiGatewayRoutingService: { preview: mocks.preview }
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
  aiGatewayRoutePreviewPresenter: declarePresenter(aiGatewayRoutePreviewType, {
    mt_2025_01_01_dashboard: v1AiGatewayRoutePreviewPresenter,
    mt_2026_01_01_magnetar: v1AiGatewayRoutePreviewPresenter
  })
}));

let { aiGatewayRoutingController } = await import('./routing');

let previewHandler = () => {
  let handler = aiGatewayRoutingController.handlers.preview;
  if (!(handler instanceof Handler)) throw new Error('Expected a preview handler');

  return handler;
};

let instance = { oid: 7n, id: 'ins_1', project: { oid: 8n }, organization: { oid: 9n } };
let context = {
  instance,
  organization: instance.organization,
  project: instance.project,
  auditScope: { organizationOid: 9n }
};

let pricing = (input: number, output: number) => ({
  currency: 'USD',
  text: { input, output, cacheRead: null, cacheWrite: [], reasoning: null },
  image: null,
  audio: null,
  video: null,
  contextTiers: [],
  units: [],
  webSearchPer1k: null
});

let preview = {
  object: 'ai_gateway#route_preview',
  requested: 'claude-sonnet-4',
  request: { kind: 'unified', raw: 'claude-sonnet-4', name: 'claude-sonnet-4' },
  via: 'alias',
  model: { slug: 'anthropic/claude-sonnet-4', labSlug: 'anthropic' },
  candidates: [
    {
      provider: 'anthropic',
      connectionOwner: 'customer',
      connectionId: 'agpc_1',
      vendorModelId: 'claude-sonnet-4-20250514',
      pricing: pricing(2.4, 12),
      pricingSource: 'connection'
    },
    { provider: 'metorial', connectionOwner: 'platform', pricing: pricing(3, 15) }
  ]
};

let request = (body: Record<string, unknown>) =>
  ({
    body,
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
  mocks.preview.mockResolvedValue(preview);
});

describe('ai gateway routing preview', () => {
  it('previews the candidates for a model', async () => {
    let result = await previewHandler().run(
      request({ model: 'claude-sonnet-4', required_features: ['zdr'] }),
      context
    );

    expect(mocks.preview).toHaveBeenCalledWith({
      instance,
      input: { model: 'claude-sonnet-4', requiredFeatures: ['zdr'] }
    });
    expect(await presented(result)).toMatchObject({
      object: 'ai_gateway.route_preview',
      requested: 'claude-sonnet-4',
      request: { type: 'unified', name: 'claude-sonnet-4' },
      via: 'alias',
      model: { slug: 'anthropic/claude-sonnet-4', lab_slug: 'anthropic' },
      candidates: [
        {
          connection_owner: 'customer',
          provider: 'anthropic',
          connection_id: 'agpc_1',
          vendor_model_id: 'claude-sonnet-4-20250514',
          pricing: { text: { input: 2.4, output: 12 } },
          pricing_source: 'connection'
        },
        {
          connection_owner: 'platform',
          provider: 'metorial',
          pricing: { text: { input: 3, output: 15 } }
        }
      ]
    });
  });

  it('never exposes which provider serves a platform candidate', async () => {
    let result = await previewHandler().run(request({ model: 'claude-sonnet-4' }), context);

    let platform = (await presented(result)).candidates[1];
    expect(Object.keys(platform).sort()).toEqual(['connection_owner', 'pricing', 'provider']);
  });

  it('rejects an unknown required feature', async () => {
    await expect(
      previewHandler().run(
        request({ model: 'claude-sonnet-4', required_features: ['hipaa'] }),
        context
      )
    ).rejects.toMatchObject({ data: { status: 400 } });
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it.each([
    [{ 'ai-gateway-enabled': false, 'paid-ai-gateway': true }, 403],
    [{ 'ai-gateway-enabled': true, 'paid-ai-gateway': false }, 402]
  ])('enforces the AI gateway flags: %o', async (flags, status) => {
    mocks.getFlags.mockResolvedValue(flags);

    await expect(
      previewHandler().run(request({ model: 'claude-sonnet-4' }), context)
    ).rejects.toMatchObject({ data: { status } });
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it('requires read access', async () => {
    mocks.checkAccess.mockRejectedValue(new ServiceError(forbiddenError()));

    await expect(
      previewHandler().run(request({ model: 'claude-sonnet-4' }), context)
    ).rejects.toMatchObject({ data: { status: 403 } });
    expect(mocks.checkAccess).toHaveBeenCalledWith(
      expect.objectContaining({ possibleScopes: ['instance.ai_gateway:read'] })
    );
    expect(mocks.preview).not.toHaveBeenCalled();
  });
});

describe('ai gateway routing introspection', () => {
  let introspection = introspectApi({
    rootController: Controller.create(
      { name: 'Test', description: 'Test' },
      { routing: aiGatewayRoutingController }
    ),
    displayVersion: 'mt_2026_01_01_magnetar',
    version: 'mt_2026_01_01_magnetar',
    isCurrent: true
  });

  it('exposes the preview under the instance aliases', () => {
    let endpoint = introspection.endpoints.find(
      endpoint => endpoint.path.sdkPath == 'aiGateway.routing.preview'
    )!;

    expect(endpoint.method).toBe('post');
    expect(endpoint.allPaths.map((path: { path: string }) => path.path)).toEqual([
      '/ai-gateway/routing/preview',
      '/instances/:instanceId/ai-gateway/routing/preview',
      '/dashboard/instances/:instanceId/ai-gateway/routing/preview'
    ]);
  });
});
