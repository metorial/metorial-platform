import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { declarePresenter } from '@metorial/presenter';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Controller,
  Group,
  Handler,
  Path
} from '../../../../../../../../platform/packages/rest/src/controller';
import { introspectApi } from '../../../../../../../../platform/packages/rest/src/introspect';
import { v1AiGatewayTokenPresenter } from '../../../../../../../../platform/presenters/src/implementation/aiGateway/token';
import { aiGatewayTokenType } from '../../../../../../../../platform/presenters/src/types';

let mocks = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  revoke: vi.fn(),
  resolveRef: vi.fn(),
  findForRefs: vi.fn(),
  checkAccess: vi.fn(),
  checkTargetAccess: vi.fn(),
  getFlags: vi.fn()
}));

vi.mock('@metorial/rest', () => ({ Controller, Group, Handler, Path }));

vi.mock('@metorial/module-ai-gateway', () => ({
  aiGatewayConsumerService: { resolveRef: mocks.resolveRef, findForRefs: mocks.findForRefs },
  aiGatewayTokenService: {
    get: mocks.get,
    list: mocks.list,
    create: mocks.create,
    update: mocks.update,
    revoke: mocks.revoke
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
  aiGatewayTokenPresenter: declarePresenter(aiGatewayTokenType, {
    mt_2025_01_01_dashboard: v1AiGatewayTokenPresenter,
    mt_2026_01_01_magnetar: v1AiGatewayTokenPresenter
  })
}));

let { aiGatewayTokenController } = await import('./token');

let tokenHandler = (method: keyof typeof aiGatewayTokenController.handlers) => {
  let handler = aiGatewayTokenController.handlers[method];
  if (!(handler instanceof Handler)) throw new Error('Expected a token handler');

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

let consumerPreview = { id: 'icon_1', name: 'Ada Lovelace', email: 'ada@example.com' };
let consumerLookup = (refs: Record<string, unknown> = { icon_1: consumerPreview }) => ({
  get: (ref: string | null) => (ref ? (refs[ref] ?? null) : null)
});

let gatewayToken = {
  id: 'agtk_1',
  prefix: 'mtag_abc',
  name: 'Production',
  consumerRef: 'icon_1',
  allowedModels: ['anthropic/claude-sonnet-4'],
  limits: [{ metric: 'tokens', amount: 1000, interval: '1d' }],
  metadata: { team: 'search' },
  lastUsedAt: null,
  expiresAt: null,
  revokedAt: null,
  createdAt: new Date('2026-11-20T10:00:00Z')
};

let request = (input: { query?: Record<string, unknown>; body?: Record<string, unknown> }) =>
  ({
    body: input.body ?? {},
    query: input.query ?? {},
    apiVersion: 'mt_2026_01_01_magnetar',
    auth: { type: 'machine' },
    params: { tokenId: 'agtk_1' },
    sharedMiddlewareMemo: new Map()
  }) as any;

let presented = async (result: { response: any }) =>
  await result.response({ apiVersion: 'mt_2026_01_01_magnetar' }).run();

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getFlags.mockResolvedValue({ 'ai-gateway-enabled': true, 'paid-ai-gateway': true });
  mocks.resolveRef.mockResolvedValue('icon_1');
  mocks.findForRefs.mockResolvedValue(consumerLookup());
  mocks.get.mockResolvedValue(gatewayToken);
  mocks.list.mockReturnValue({
    run: vi.fn().mockResolvedValue({
      items: [gatewayToken],
      pagination: { hasMoreBefore: false, hasMoreAfter: false }
    })
  });
  mocks.create.mockResolvedValue({ ...gatewayToken, secret: 'mtag_abc_secret' });
  mocks.update.mockResolvedValue(gatewayToken);
  mocks.revoke.mockResolvedValue({ ...gatewayToken, revokedAt: new Date() });
});

describe('ai gateway tokens', () => {
  it('returns the secret once, when the token is created', async () => {
    let result = await tokenHandler('create').run(
      request({
        body: {
          name: 'Production',
          consumer_id: 'con_1',
          allowed_models: ['anthropic/claude-sonnet-4'],
          limits: [{ metric: 'tokens', amount: 1000, interval: '1d' }]
        }
      }),
      context
    );

    expect(mocks.create).toHaveBeenCalledWith({
      instance,
      auditScope,
      input: {
        name: 'Production',
        consumerRef: 'icon_1',
        allowedModels: ['anthropic/claude-sonnet-4'],
        limits: [{ metric: 'tokens', amount: 1000, interval: '1d' }],
        metadata: undefined,
        expiresAt: undefined
      }
    });
    expect(await presented(result)).toMatchObject({
      object: 'ai_gateway.token',
      id: 'agtk_1',
      secret: 'mtag_abc_secret',
      consumer: { object: 'consumer#preview', ...consumerPreview }
    });
    expect(mocks.resolveRef).toHaveBeenCalledWith({ instance, consumerId: 'con_1' });
    expect(mocks.checkAccess).toHaveBeenCalledWith(
      expect.objectContaining({ possibleScopes: ['instance.ai_gateway:write'] })
    );
  });

  it('never returns the secret when reading a token', async () => {
    let result = await tokenHandler('get').run(request({}), context);

    expect(mocks.get).toHaveBeenCalledWith({ instance, gatewayTokenId: 'agtk_1' });
    expect(await presented(result)).toMatchObject({ id: 'agtk_1', secret: null });
  });

  it('filters the list by consumer', async () => {
    await tokenHandler('list').run(request({ query: { consumer_id: 'con_1' } }), context);

    expect(mocks.resolveRef).toHaveBeenCalledWith({ instance, consumerId: 'con_1' });
    expect(mocks.list).toHaveBeenCalledWith({ instance, consumerRef: 'icon_1' });
  });

  it('embeds the consumers of a whole page with one lookup', async () => {
    let other = { ...gatewayToken, id: 'agtk_2', consumerRef: null };
    mocks.list.mockReturnValue({
      run: vi.fn().mockResolvedValue({
        items: [gatewayToken, other, gatewayToken],
        pagination: { hasMoreBefore: false, hasMoreAfter: false }
      })
    });

    let result = await tokenHandler('list').run(request({}), context);
    let list = await presented(result);

    expect(mocks.findForRefs).toHaveBeenCalledTimes(1);
    expect(mocks.findForRefs).toHaveBeenCalledWith({
      instance,
      refs: ['icon_1', null, 'icon_1']
    });
    expect(list.items.map((item: any) => item.consumer?.id ?? null)).toEqual([
      'icon_1',
      null,
      'icon_1'
    ]);
  });

  it('rejects a consumer that does not exist', async () => {
    mocks.resolveRef.mockRejectedValue(new ServiceError(notFoundError('consumer')));

    await expect(
      tokenHandler('create').run(
        request({ body: { name: 'Production', consumer_id: 'con_x' } }),
        context
      )
    ).rejects.toMatchObject({ data: { status: 404 } });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('presents no consumer when the token has none', async () => {
    mocks.get.mockResolvedValue({ ...gatewayToken, consumerRef: null });

    let result = await tokenHandler('get').run(request({}), context);

    expect((await presented(result)).consumer).toBeNull();
  });

  it('clears the expiry with null', async () => {
    await tokenHandler('update').run(request({ body: { expires_at: null } }), context);

    expect(mocks.update).toHaveBeenCalledWith({
      instance,
      gatewayToken,
      auditScope,
      input: {
        name: undefined,
        allowedModels: undefined,
        limits: undefined,
        metadata: undefined,
        expiresAt: null
      }
    });
  });

  it('rejects an unknown limit metric', async () => {
    await expect(
      tokenHandler('update').run(
        request({ body: { limits: [{ metric: 'cost', amount: 1, interval: '1d' }] } }),
        context
      )
    ).rejects.toMatchObject({ data: { status: 400 } });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('revokes the loaded token', async () => {
    await tokenHandler('revoke').run(request({}), context);

    expect(mocks.revoke).toHaveBeenCalledWith({ instance, gatewayToken, auditScope });
  });

  it.each([
    [{ 'ai-gateway-enabled': false, 'paid-ai-gateway': true }, 403],
    [{ 'ai-gateway-enabled': true, 'paid-ai-gateway': false }, 402]
  ])('enforces the AI gateway flags: %o', async (flags, status) => {
    mocks.getFlags.mockResolvedValue(flags);

    await expect(tokenHandler('list').run(request({}), context)).rejects.toMatchObject({
      data: { status }
    });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('rejects callers without write access', async () => {
    mocks.checkAccess.mockRejectedValue(new ServiceError(forbiddenError()));

    await expect(tokenHandler('revoke').run(request({}), context)).rejects.toMatchObject({
      data: { status: 403 }
    });
    expect(mocks.revoke).not.toHaveBeenCalled();
  });
});

describe('ai gateway token introspection', () => {
  let introspection = introspectApi({
    rootController: Controller.create(
      { name: 'Test', description: 'Test' },
      { tokens: aiGatewayTokenController }
    ),
    displayVersion: 'mt_2026_01_01_magnetar',
    version: 'mt_2026_01_01_magnetar',
    isCurrent: true
  });

  it('exposes every route under the instance aliases', () => {
    let revoke = introspection.endpoints.find(
      endpoint => endpoint.path.sdkPath == 'aiGateway.tokens.revoke'
    )!;

    expect(revoke.method).toBe('post');
    expect(revoke.allPaths.map((path: { path: string }) => path.path)).toEqual([
      '/ai-gateway/tokens/:tokenId/revoke',
      '/instances/:instanceId/ai-gateway/tokens/:tokenId/revoke',
      '/dashboard/instances/:instanceId/ai-gateway/tokens/:tokenId/revoke'
    ]);
  });
});
