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
  v1AiGatewayVirtualModelPresenter,
  v1AiGatewayVirtualModelVersionPresenter
} from '../../../../../../presenters/src/implementation/aiGateway/virtualModel';
import {
  aiGatewayVirtualModelType,
  aiGatewayVirtualModelVersionType
} from '../../../../../../presenters/src/types';

let mocks = vi.hoisted(() => ({
  get: vi.fn(),
  listVersions: vi.fn(),
  getVersion: vi.fn(),
  checkAccess: vi.fn(),
  checkTargetAccess: vi.fn(),
  getFlags: vi.fn()
}));

vi.mock('@metorial/rest', () => ({ Controller, Group, Handler, Path }));

vi.mock('@metorial/module-ai-gateway', () => ({
  aiGatewayVirtualModelService: {
    get: mocks.get,
    listVersions: mocks.listVersions,
    getVersion: mocks.getVersion
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
vi.mock('@metorial/presenters', () => {
  let virtualModelPresenter = declarePresenter(aiGatewayVirtualModelType, {
    mt_2025_01_01_dashboard: v1AiGatewayVirtualModelPresenter,
    mt_2026_01_01_magnetar: v1AiGatewayVirtualModelPresenter
  });

  return {
    aiGatewayVirtualModelPresenter: virtualModelPresenter,
    aiGatewayVirtualModelTestPresenter: virtualModelPresenter,
    aiGatewayVirtualModelReplayPresenter: virtualModelPresenter,
    aiGatewayVirtualModelInsightsPresenter: virtualModelPresenter,
    aiGatewayVirtualModelVersionPresenter: declarePresenter(aiGatewayVirtualModelVersionType, {
      mt_2025_01_01_dashboard: v1AiGatewayVirtualModelVersionPresenter,
      mt_2026_01_01_magnetar: v1AiGatewayVirtualModelVersionPresenter
    })
  };
});

let { aiGatewayVirtualModelVersionController } = await import('./virtualModelVersion');

let versionHandler = (
  method: keyof typeof aiGatewayVirtualModelVersionController.handlers
) => {
  let handler = aiGatewayVirtualModelVersionController.handlers[method];
  if (!(handler instanceof Handler)) throw new Error('Expected a version handler');

  return handler;
};

let instance = { oid: 7n, id: 'ins_1', project: { oid: 8n }, organization: { oid: 9n } };
let context = {
  instance,
  organization: instance.organization,
  project: instance.project,
  auditScope: { organizationOid: 9n }
};

let version = {
  object: 'ai_gateway#virtual_model_version',
  id: 'avmv_1',
  number: 1,
  definition: {
    rules: [
      {
        id: 'images',
        when: 'request.has_images',
        models: [{ model: 'openai/gpt-5', weight: 2 }],
        overrides: { maxOutputTokens: 2048 }
      }
    ],
    default: { models: [{ model: 'openai/gpt-5-mini' }], overrides: { temperature: 0.3 } }
  },
  targetModelSlugs: ['openai/gpt-5', 'openai/gpt-5-mini'],
  createdAt: new Date('2026-11-18T10:00:00Z')
};

let virtualModel = {
  id: 'avm_1',
  slug: 'smart-router',
  name: 'Smart router',
  description: null,
  currentVersion: version,
  warnings: [],
  archivedAt: null,
  createdAt: new Date('2026-11-18T10:00:00Z'),
  updatedAt: new Date('2026-11-18T10:00:00Z')
};

let request = (input: { query?: Record<string, unknown>; params?: Record<string, string> }) =>
  ({
    body: {},
    query: input.query ?? {},
    apiVersion: 'mt_2026_01_01_magnetar',
    auth: { type: 'machine' },
    params: input.params ?? { virtualModelId: 'avm_1', versionId: 'avmv_1' },
    sharedMiddlewareMemo: new Map()
  }) as any;

let presented = async (result: { response: any }) =>
  await result.response({ apiVersion: 'mt_2026_01_01_magnetar' }).run();

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getFlags.mockResolvedValue({ 'ai-gateway-enabled': true, 'paid-ai-gateway': true });
  mocks.get.mockResolvedValue(virtualModel);
  mocks.getVersion.mockResolvedValue(version);
  mocks.listVersions.mockReturnValue({
    run: vi.fn().mockResolvedValue({
      items: [version],
      pagination: { hasNextPage: true, hasPreviousPage: false, after: 'avmv_1' }
    })
  });
});

describe('ai gateway virtual model versions', () => {
  it('lists the versions of the loaded virtual model', async () => {
    let result = await versionHandler('list').run(request({ query: { limit: 1 } }), context);

    expect(mocks.get).toHaveBeenCalledWith({ instance, virtualModelId: 'avm_1' });
    expect(mocks.listVersions).toHaveBeenCalledWith({ instance, virtualModel });
    expect(await presented(result)).toMatchObject({
      items: [{ object: 'ai_gateway.virtual_model.version', id: 'avmv_1' }],
      pagination: { has_more_after: true, has_more_before: false, after: 'avmv_1' }
    });
  });

  it('presents a version with its snake case definition', async () => {
    let result = await versionHandler('get').run(request({}), context);

    expect(mocks.getVersion).toHaveBeenCalledWith({
      instance,
      virtualModel,
      versionId: 'avmv_1'
    });
    expect(await presented(result)).toEqual({
      object: 'ai_gateway.virtual_model.version',
      id: 'avmv_1',
      number: 1,
      definition: {
        decision: null,
        signals: null,
        rules: [
          {
            id: 'images',
            description: null,
            when: 'request.has_images',
            models: [{ model: 'openai/gpt-5', weight: 2 }],
            overrides: { reasoning_effort: null, max_output_tokens: 2048, temperature: null }
          }
        ],
        default: {
          models: [{ model: 'openai/gpt-5-mini', weight: null }],
          overrides: { reasoning_effort: null, max_output_tokens: null, temperature: 0.3 }
        },
        stickiness: null
      },
      target_models: ['openai/gpt-5', 'openai/gpt-5-mini'],
      created_at: new Date('2026-11-18T10:00:00Z')
    });
  });

  it.each([
    [{ 'ai-gateway-enabled': false, 'paid-ai-gateway': true }, 403],
    [{ 'ai-gateway-enabled': true, 'paid-ai-gateway': false }, 402]
  ])('enforces the AI gateway flags: %o', async (flags, status) => {
    mocks.getFlags.mockResolvedValue(flags);

    await expect(versionHandler('list').run(request({}), context)).rejects.toMatchObject({
      data: { status }
    });
    expect(mocks.listVersions).not.toHaveBeenCalled();
  });

  it('rejects callers without read access', async () => {
    mocks.checkAccess.mockRejectedValue(new ServiceError(forbiddenError()));

    await expect(versionHandler('get').run(request({}), context)).rejects.toMatchObject({
      data: { status: 403 }
    });
    expect(mocks.checkAccess).toHaveBeenCalledWith(
      expect.objectContaining({ possibleScopes: ['instance.ai_gateway:read'] })
    );
    expect(mocks.getVersion).not.toHaveBeenCalled();
  });
});

describe('ai gateway virtual model version introspection', () => {
  let introspection = introspectApi({
    rootController: Controller.create(
      { name: 'Test', description: 'Test' },
      { versions: aiGatewayVirtualModelVersionController }
    ),
    displayVersion: 'mt_2026_01_01_magnetar',
    version: 'mt_2026_01_01_magnetar',
    isCurrent: true
  });

  it('nests versions under their virtual model', () => {
    let get = introspection.endpoints.find(
      endpoint => endpoint.path.sdkPath == 'aiGateway.virtualModels.versions.get'
    )!;

    expect(get.allPaths.map((path: { path: string }) => path.path)).toEqual([
      '/ai-gateway/virtual-models/:virtualModelId/versions/:versionId',
      '/instances/:instanceId/ai-gateway/virtual-models/:virtualModelId/versions/:versionId',
      '/dashboard/instances/:instanceId/ai-gateway/virtual-models/:virtualModelId/versions/:versionId'
    ]);
  });
});
