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
import {
  v1AiGatewayLabPresenter,
  v1AiGatewayModelOfferingPresenter,
  v1AiGatewayModelPresenter,
  v1AiGatewayModelResolutionPresenter,
  v1AiGatewayProviderPresenter
} from '../../../../../../presenters/src/implementation/aiGateway/catalog';
import {
  aiGatewayLabType,
  aiGatewayModelOfferingType,
  aiGatewayModelResolutionType,
  aiGatewayModelType,
  aiGatewayProviderType
} from '../../../../../../presenters/src/types';

let mocks = vi.hoisted(() => ({
  listLabs: vi.fn(),
  listProviders: vi.fn(),
  listModels: vi.fn(),
  getModel: vi.fn(),
  listOfferings: vi.fn(),
  resolveModel: vi.fn(),
  checkAccess: vi.fn(),
  checkTargetAccess: vi.fn(),
  getFlags: vi.fn()
}));

vi.mock('@metorial/rest', () => ({ Controller, Group, Handler, Path }));

vi.mock('@metorial/module-ai-gateway', () => ({
  aiGatewayCatalogService: {
    listLabs: mocks.listLabs,
    listProviders: mocks.listProviders,
    listModels: mocks.listModels,
    getModel: mocks.getModel,
    listOfferings: mocks.listOfferings,
    resolveModel: mocks.resolveModel
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
  aiGatewayLabPresenter: declarePresenter(aiGatewayLabType, {
    mt_2025_01_01_dashboard: v1AiGatewayLabPresenter,
    mt_2026_01_01_magnetar: v1AiGatewayLabPresenter
  }),
  aiGatewayProviderPresenter: declarePresenter(aiGatewayProviderType, {
    mt_2025_01_01_dashboard: v1AiGatewayProviderPresenter,
    mt_2026_01_01_magnetar: v1AiGatewayProviderPresenter
  }),
  aiGatewayModelPresenter: declarePresenter(aiGatewayModelType, {
    mt_2025_01_01_dashboard: v1AiGatewayModelPresenter,
    mt_2026_01_01_magnetar: v1AiGatewayModelPresenter
  }),
  aiGatewayModelOfferingPresenter: declarePresenter(aiGatewayModelOfferingType, {
    mt_2025_01_01_dashboard: v1AiGatewayModelOfferingPresenter,
    mt_2026_01_01_magnetar: v1AiGatewayModelOfferingPresenter
  }),
  aiGatewayModelResolutionPresenter: declarePresenter(aiGatewayModelResolutionType, {
    mt_2025_01_01_dashboard: v1AiGatewayModelResolutionPresenter,
    mt_2026_01_01_magnetar: v1AiGatewayModelResolutionPresenter
  })
}));

let {
  aiGatewayLabController,
  aiGatewayModelController,
  aiGatewayModelOfferingController,
  aiGatewayProviderController
} = await import('./catalog');

let handlerOf = (controller: { handlers: Record<string, unknown> }, method: string) => {
  let handler = controller.handlers[method];
  if (!(handler instanceof Handler)) throw new Error(`Expected a ${method} handler`);

  return handler;
};

let instance = { oid: 7n, id: 'ins_1', project: { oid: 8n }, organization: { oid: 9n } };
let context = {
  instance,
  organization: instance.organization,
  project: instance.project,
  auditScope: { organizationOid: 9n }
};

let capabilities = {
  tools: true,
  toolChoice: ['auto', 'required', 'none'],
  structuredOutput: true,
  reasoning: { toggle: true, effort: ['low', 'medium', 'high'] },
  temperature: true,
  promptCaching: { implicit: false, explicit: true, ttls: ['5m', '1h'] },
  attachments: true
};

let model = {
  object: 'ai_gateway#model',
  id: 'agmd_1',
  slug: 'anthropic/claude-sonnet-4',
  name: 'Claude Sonnet 4',
  description: null,
  kind: 'chat',
  status: 'active',
  lab: { id: 'aglb_1', slug: 'anthropic', name: 'Anthropic' },
  familySlug: 'claude-sonnet',
  releaseDate: new Date('2025-05-22T00:00:00Z'),
  openWeights: false,
  contextTokens: 200000,
  outputTokens: 64000,
  modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
  capabilities
};

let pricing = {
  currency: 'USD',
  text: {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheWrite: [{ ttl: '5m', price: 3.75 }],
    reasoning: null
  },
  image: null,
  audio: null,
  video: null,
  contextTiers: [],
  units: [],
  webSearchPer1k: 10
};

let offering = {
  object: 'ai_gateway#model_offering',
  id: 'agof_1',
  name: 'bedrock:anthropic.claude-sonnet-4-20250514-v1:0',
  vendorModelId: 'anthropic.claude-sonnet-4-20250514-v1:0',
  displayName: 'Claude Sonnet 4',
  status: 'active',
  provider: { id: 'agpv_1', slug: 'bedrock' },
  model: { id: 'agmd_1', slug: 'anthropic/claude-sonnet-4' },
  apis: ['converse'],
  pricing,
  contextTokens: 200000,
  outputTokens: 64000,
  modalities: { input: ['text'], output: ['text'] },
  capabilities: { ...capabilities, reasoning: null, promptCaching: null },
  variant: { serving: null, reasoning: null, quantization: null, free: false, region: 'eu' }
};

let page = (items: unknown[]) => ({
  run: vi.fn().mockResolvedValue({
    items,
    pagination: { hasMoreBefore: false, hasMoreAfter: false }
  })
});

let request = (input: {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
}) =>
  ({
    body: input.body ?? {},
    query: input.query ?? {},
    apiVersion: 'mt_2026_01_01_magnetar',
    auth: { type: 'machine' },
    params: input.params ?? {},
    sharedMiddlewareMemo: new Map()
  }) as any;

let presented = async (result: { response: any }) =>
  await result.response({ apiVersion: 'mt_2026_01_01_magnetar' }).run();

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getFlags.mockResolvedValue({ 'ai-gateway-enabled': true, 'paid-ai-gateway': true });
  mocks.listLabs.mockReturnValue(page([]));
  mocks.listProviders.mockReturnValue(page([]));
  mocks.listModels.mockReturnValue(page([model]));
  mocks.getModel.mockResolvedValue(model);
  mocks.listOfferings.mockReturnValue(page([offering]));
});

describe('ai gateway catalog', () => {
  it('maps the model filters and presents models in snake case', async () => {
    let result = await handlerOf(aiGatewayModelController, 'list').run(
      request({ query: { lab: 'anthropic', kind: 'chat', search: 'sonnet' } }),
      context
    );

    expect(mocks.listModels).toHaveBeenCalledWith({
      labSlug: 'anthropic',
      kind: 'chat',
      search: 'sonnet'
    });
    expect((await presented(result)).items[0]).toEqual({
      object: 'ai_gateway.model',
      id: 'agmd_1',
      slug: 'anthropic/claude-sonnet-4',
      name: 'Claude Sonnet 4',
      description: null,
      kind: 'chat',
      status: 'active',
      lab: { id: 'aglb_1', slug: 'anthropic', name: 'Anthropic' },
      family_slug: 'claude-sonnet',
      release_date: new Date('2025-05-22T00:00:00Z'),
      open_weights: false,
      context_window: 200000,
      max_output_tokens: 64000,
      modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
      capabilities: {
        tools: true,
        tool_choice: ['auto', 'required', 'none'],
        structured_output: true,
        reasoning: { toggle: true, effort: ['low', 'medium', 'high'] },
        temperature: true,
        prompt_caching: { implicit: false, explicit: true, ttls: ['5m', '1h'] },
        attachments: true
      }
    });
    expect(mocks.checkAccess).toHaveBeenCalledWith(
      expect.objectContaining({ possibleScopes: ['instance.ai_gateway:read'] })
    );
  });

  it('loads a model by slug from the path', async () => {
    let result = await handlerOf(aiGatewayModelController, 'get').run(
      request({ params: { modelId: 'anthropic/claude-sonnet-4' } }),
      context
    );

    expect(mocks.getModel).toHaveBeenCalledWith({ modelId: 'anthropic/claude-sonnet-4' });
    expect(await presented(result)).toMatchObject({
      id: 'agmd_1',
      object: 'ai_gateway.model'
    });
  });

  it('presents how a model string was resolved', async () => {
    mocks.resolveModel.mockResolvedValue({
      object: 'ai_gateway#model_resolution',
      requested: 'bedrock:anthropic.claude-sonnet-4-20250514-v1:0',
      request: {
        kind: 'pinned',
        raw: 'bedrock:anthropic.claude-sonnet-4-20250514-v1:0',
        providerSlug: 'bedrock',
        vendorModelId: 'anthropic.claude-sonnet-4-20250514-v1:0'
      },
      via: 'offering',
      model
    });

    let result = await handlerOf(aiGatewayModelController, 'resolve').run(
      request({ body: { model: 'bedrock:anthropic.claude-sonnet-4-20250514-v1:0' } }),
      context
    );

    expect(mocks.resolveModel).toHaveBeenCalledWith({
      model: 'bedrock:anthropic.claude-sonnet-4-20250514-v1:0'
    });
    expect(await presented(result)).toMatchObject({
      object: 'ai_gateway.model.resolution',
      requested: 'bedrock:anthropic.claude-sonnet-4-20250514-v1:0',
      request: {
        type: 'pinned',
        provider: 'bedrock',
        vendor_model_id: 'anthropic.claude-sonnet-4-20250514-v1:0'
      },
      via: 'offering',
      model: { object: 'ai_gateway.model', slug: 'anthropic/claude-sonnet-4' }
    });
  });

  it('rejects an empty model string', async () => {
    await expect(
      handlerOf(aiGatewayModelController, 'resolve').run(
        request({ body: { model: '' } }),
        context
      )
    ).rejects.toMatchObject({ data: { status: 400 } });
    expect(mocks.resolveModel).not.toHaveBeenCalled();
  });

  it('maps the offering filters and presents pricing and variants', async () => {
    let result = await handlerOf(aiGatewayModelOfferingController, 'list').run(
      request({ query: { model_id: 'anthropic/claude-sonnet-4', provider: 'bedrock' } }),
      context
    );

    expect(mocks.listOfferings).toHaveBeenCalledWith({
      modelId: 'anthropic/claude-sonnet-4',
      providerSlug: 'bedrock'
    });
    expect((await presented(result)).items[0]).toMatchObject({
      object: 'ai_gateway.model.offering',
      pinned_model: 'bedrock:anthropic.claude-sonnet-4-20250514-v1:0',
      vendor_model_id: 'anthropic.claude-sonnet-4-20250514-v1:0',
      display_name: 'Claude Sonnet 4',
      provider: { id: 'agpv_1', slug: 'bedrock' },
      model: { id: 'agmd_1', slug: 'anthropic/claude-sonnet-4' },
      pricing: {
        currency: 'USD',
        text: {
          input: 3,
          output: 15,
          cache_read: 0.3,
          cache_write: [{ ttl: '5m', price: 3.75 }],
          reasoning: null
        },
        web_search_per_1k: 10,
        conditions: []
      },
      capabilities: { reasoning: null, prompt_caching: null },
      variant: {
        serving: null,
        reasoning: null,
        quantization: null,
        free: false,
        region: 'eu'
      }
    });
  });

  it('presents the features connections to a provider can enable', async () => {
    mocks.listProviders.mockReturnValue(
      page([
        {
          object: 'ai_gateway#provider',
          id: 'agpv_1',
          slug: 'bedrock',
          name: 'Amazon Bedrock',
          kind: 'cloud',
          website: null,
          docs: null,
          logo: null,
          status: 'active',
          supported: true,
          features: ['zdr']
        }
      ])
    );

    let result = await handlerOf(aiGatewayProviderController, 'list').run(
      request({}),
      context
    );

    expect((await presented(result)).items[0]).toMatchObject({
      object: 'ai_gateway.provider',
      kind: 'cloud',
      supported: true,
      features: { zdr: true }
    });
  });

  it.each([
    [{ 'ai-gateway-enabled': false, 'paid-ai-gateway': true }, 403],
    [{ 'ai-gateway-enabled': true, 'paid-ai-gateway': false }, 402]
  ])('enforces the AI gateway flags: %o', async (flags, status) => {
    mocks.getFlags.mockResolvedValue(flags);

    await expect(
      handlerOf(aiGatewayLabController, 'list').run(request({}), context)
    ).rejects.toMatchObject({ data: { status } });
    expect(mocks.listLabs).not.toHaveBeenCalled();
  });

  it('rejects callers without read access', async () => {
    mocks.checkAccess.mockRejectedValue(new ServiceError(forbiddenError()));

    await expect(
      handlerOf(aiGatewayModelOfferingController, 'list').run(request({}), context)
    ).rejects.toMatchObject({ data: { status: 403 } });
    expect(mocks.listOfferings).not.toHaveBeenCalled();
  });
});

describe('ai gateway catalog introspection', () => {
  let introspection = introspectApi({
    rootController: Controller.create(
      { name: 'Test', description: 'Test' },
      {
        labs: aiGatewayLabController,
        providers: aiGatewayProviderController,
        models: aiGatewayModelController,
        offerings: aiGatewayModelOfferingController
      }
    ),
    displayVersion: 'mt_2026_01_01_magnetar',
    version: 'mt_2026_01_01_magnetar',
    isCurrent: true
  });

  it('exposes every route under the instance aliases', () => {
    let routes = introspection.endpoints
      .filter((endpoint: any) => !endpoint.path.sdkPath.includes('instance.'))
      .map(
        (endpoint: any) => `${endpoint.method} ${endpoint.path.path} ${endpoint.path.sdkPath}`
      );

    expect(routes.sort()).toEqual(
      [
        'get /ai-gateway/labs aiGateway.labs.list',
        'get /ai-gateway/providers aiGateway.providers.list',
        'get /ai-gateway/models aiGateway.models.list',
        'get /ai-gateway/models/:modelId aiGateway.models.get',
        'post /ai-gateway/models/resolve aiGateway.models.resolve',
        'get /ai-gateway/model-offerings aiGateway.modelOfferings.list'
      ].sort()
    );
  });
});
