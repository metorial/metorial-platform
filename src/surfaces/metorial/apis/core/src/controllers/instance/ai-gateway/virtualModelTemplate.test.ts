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
import { v1AiGatewayVirtualModelTemplatePresenter } from '../../../../../../../../platform/presenters/src/implementation/aiGateway/virtualModel';
import { aiGatewayVirtualModelTemplateType } from '../../../../../../../../platform/presenters/src/types';

let mocks = vi.hoisted(() => ({
  listTemplates: vi.fn(),
  checkAccess: vi.fn(),
  checkTargetAccess: vi.fn(),
  getFlags: vi.fn()
}));

vi.mock('@metorial/rest', () => ({ Controller, Group, Handler, Path }));

vi.mock('@metorial/module-ai-gateway', () => ({
  aiGatewayVirtualModelService: { listTemplates: mocks.listTemplates }
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
  aiGatewayVirtualModelTemplatePresenter: declarePresenter(aiGatewayVirtualModelTemplateType, {
    mt_2025_01_01_dashboard: v1AiGatewayVirtualModelTemplatePresenter,
    mt_2026_01_01_magnetar: v1AiGatewayVirtualModelTemplatePresenter
  })
}));

let { aiGatewayVirtualModelTemplateController } = await import('./virtualModelTemplate');

let listHandler = () => {
  let handler = aiGatewayVirtualModelTemplateController.handlers.list;
  if (!(handler instanceof Handler)) throw new Error('Expected a template handler');

  return handler;
};

let instance = { oid: 7n, id: 'ins_1', project: { oid: 8n }, organization: { oid: 9n } };
let context = {
  instance,
  organization: instance.organization,
  project: instance.project,
  auditScope: { organizationOid: 9n }
};

let template = {
  object: 'ai_gateway#virtual_model_template',
  slug: 'complexity-tiers',
  name: 'Complexity tiers',
  description: 'Routes by how hard each request is.',
  parameters: [
    { key: 'cheap', name: 'Cheap model', description: 'Handles simple requests.' },
    { key: 'premium', name: 'Premium model', description: 'Handles hard requests.' }
  ],
  usesDecisionModel: true
};

let request = () =>
  ({
    body: {},
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
  mocks.listTemplates.mockResolvedValue([template]);
});

describe('ai gateway virtual model templates', () => {
  it('returns every template in the standard list envelope', async () => {
    let result = await listHandler().run(request(), context);

    expect(mocks.listTemplates).toHaveBeenCalledWith({ instance });
    expect(await presented(result)).toEqual({
      object: 'list',
      items: [
        {
          object: 'ai_gateway.virtual_model.template',
          slug: 'complexity-tiers',
          name: 'Complexity tiers',
          description: 'Routes by how hard each request is.',
          parameters: [
            { key: 'cheap', name: 'Cheap model', description: 'Handles simple requests.' },
            { key: 'premium', name: 'Premium model', description: 'Handles hard requests.' }
          ],
          uses_decision_model: true
        }
      ],
      pagination: { has_more_after: false, has_more_before: false }
    });
  });

  it.each([
    [{ 'ai-gateway-enabled': false, 'paid-ai-gateway': true }, 403],
    [{ 'ai-gateway-enabled': true, 'paid-ai-gateway': false }, 402]
  ])('enforces the AI gateway flags: %o', async (flags, status) => {
    mocks.getFlags.mockResolvedValue(flags);

    await expect(listHandler().run(request(), context)).rejects.toMatchObject({
      data: { status }
    });
    expect(mocks.listTemplates).not.toHaveBeenCalled();
  });

  it('rejects callers without read access', async () => {
    mocks.checkAccess.mockRejectedValue(new ServiceError(forbiddenError()));

    await expect(listHandler().run(request(), context)).rejects.toMatchObject({
      data: { status: 403 }
    });
    expect(mocks.checkAccess).toHaveBeenCalledWith(
      expect.objectContaining({ possibleScopes: ['instance.ai_gateway:read'] })
    );
    expect(mocks.listTemplates).not.toHaveBeenCalled();
  });
});

describe('ai gateway virtual model template introspection', () => {
  let introspection = introspectApi({
    rootController: Controller.create(
      { name: 'Test', description: 'Test' },
      { templates: aiGatewayVirtualModelTemplateController }
    ),
    displayVersion: 'mt_2026_01_01_magnetar',
    version: 'mt_2026_01_01_magnetar',
    isCurrent: true
  });

  it('documents the template list as a list', () => {
    let list = introspection.endpoints.find(
      endpoint => endpoint.path.sdkPath == 'aiGateway.virtualModelTemplates.list'
    )!;

    expect(list.path.path).toBe('/ai-gateway/virtual-model-templates');
    expect(list.method).toBe('get');
  });
});
