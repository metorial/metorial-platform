import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  gateway: {
    instance: { get: vi.fn(), upsert: vi.fn() },
    project: { get: vi.fn() },
    gatewayToken: { list: vi.fn(), get: vi.fn(), create: vi.fn() },
    providerConnection: { setEnabled: vi.fn() },
    inferenceLog: { list: vi.fn(), get: vi.fn() }
  },
  fire: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  addAfterTransactionHook: async (hook: () => unknown) => await hook(),
  db: { instance: { update: vi.fn() } }
}));

vi.mock('@metorial/fabric', () => ({ Fabric: { fire: mocks.fire } }));

vi.mock('../src/lib/client', () => ({ requireAiGateway: () => mocks.gateway }));

vi.mock('@metorial/module-consumer-core', () => ({ consumerService: {} }));

import {
  aiGatewayConfigService,
  aiGatewayInferenceLogService,
  aiGatewayProviderConnectionService,
  aiGatewayTokenService
} from '../src/services';

let auditScope = { type: 'test' } as any;
let instance = {
  oid: 3n,
  id: 'inst_1',
  name: 'Default',
  aiGatewayInstanceId: 'agin_1',
  organization: { oid: 1n, id: 'org_1', name: 'Acme' },
  project: { oid: 2n, id: 'proj_1', name: 'Production' }
} as any;

let scope = { organizationId: 'org_1', instanceId: 'inst_1' };

let token = (overrides: Record<string, unknown> = {}) => ({
  id: 'agtk_1',
  name: 'Backend',
  consumerRef: null,
  allowedModels: [],
  expiresAt: null,
  revokedAt: null,
  instance: { id: 'agin_1', ref: 'inst_1', projectId: 'agpr_1' },
  ...overrides
});

describe('ai gateway services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pages gateway lists through item-id cursors', async () => {
    mocks.gateway.gatewayToken.list.mockResolvedValue({
      items: [token({ id: 'agtk_1' }), token({ id: 'agtk_2' })],
      pagination: { has_more_after: true, has_more_before: false }
    });

    let first = await aiGatewayTokenService.list({ instance }).run({ limit: 2 });

    expect(mocks.gateway.gatewayToken.list).toHaveBeenCalledWith({
      ...scope,
      consumerRef: undefined,
      limit: 2,
      order: 'asc'
    });
    expect(first.pagination).toMatchObject({ hasNextPage: true, hasPreviousPage: false });

    await aiGatewayTokenService
      .list({ instance })
      .run({ limit: 2, after: first.pagination.after });

    expect(mocks.gateway.gatewayToken.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: 'agtk_2' })
    );
  });

  it('hides tokens that belong to another instance', async () => {
    mocks.gateway.gatewayToken.get.mockResolvedValue(
      token({ instance: { id: 'agin_2', ref: 'inst_2', projectId: 'agpr_1' } })
    );

    await expect(
      aiGatewayTokenService.get({ instance, gatewayTokenId: 'agtk_1' })
    ).rejects.toThrow();
  });

  it('creates tokens in the caller instance and records the action', async () => {
    mocks.gateway.gatewayToken.create.mockResolvedValue({ ...token(), secret: 'mtgw_secret' });

    await aiGatewayTokenService.create({
      instance,
      auditScope,
      input: { name: 'Backend', organizationId: 'org_x', instanceId: 'inst_x' } as any
    });

    expect(mocks.gateway.gatewayToken.create).toHaveBeenCalledWith({
      name: 'Backend',
      ...scope
    });
    expect(mocks.fire).toHaveBeenCalledWith('ai_gateway.token.created:after', {
      auditScope,
      instance,
      token: {
        id: 'agtk_1',
        name: 'Backend',
        consumerRef: null,
        allowedModels: [],
        expiresAt: null,
        revokedAt: null
      }
    });
  });

  it('records the previous state when a connection is disabled', async () => {
    let connection = {
      id: 'agpc_1',
      name: 'OpenAI',
      provider: { slug: 'openai' },
      status: 'valid',
      priority: 0
    } as any;
    mocks.gateway.providerConnection.setEnabled.mockResolvedValue({
      ...connection,
      status: 'disabled'
    });

    await aiGatewayProviderConnectionService.setEnabled({
      instance,
      connection,
      auditScope,
      enabled: false
    });

    expect(mocks.fire).toHaveBeenCalledWith(
      'ai_gateway.provider_connection.updated:after',
      expect.objectContaining({
        connection: expect.objectContaining({ status: 'disabled' }),
        previousConnection: expect.objectContaining({ status: 'valid' })
      })
    );
  });

  it('updates config through an instance upsert that keeps the core name', async () => {
    let gatewayInstance = { logRetentionDays: 30, settings: {}, limits: [] };
    mocks.gateway.instance.get.mockResolvedValue(gatewayInstance);
    mocks.gateway.instance.upsert.mockResolvedValue({
      ...gatewayInstance,
      logRetentionDays: 7
    });

    await aiGatewayConfigService.update({
      instance,
      auditScope,
      input: { logRetentionDays: 7 }
    });

    expect(mocks.gateway.instance.upsert).toHaveBeenCalledWith({
      organizationId: 'org_1',
      projectId: 'proj_1',
      ref: 'inst_1',
      name: 'Default',
      logRetentionDays: 7,
      settings: undefined,
      limits: undefined
    });
    expect(mocks.fire).toHaveBeenCalledWith(
      'ai_gateway.config.updated:after',
      expect.objectContaining({
        config: expect.objectContaining({ logRetentionDays: 7 }),
        previousConfig: expect.objectContaining({ logRetentionDays: 30 })
      })
    );
  });

  it('pages inference logs towards older entries only', async () => {
    mocks.gateway.inferenceLog.list.mockResolvedValue({
      items: [{ id: 'aglg_2' }],
      hasMore: true,
      nextCursor: 'aglg_2'
    });

    let first = await aiGatewayInferenceLogService.list({ instance }).run({ limit: 1 });
    await aiGatewayInferenceLogService
      .list({ instance })
      .run({ limit: 1, after: first.pagination.after });

    expect(mocks.gateway.inferenceLog.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ ...scope, limit: 1, before: 'aglg_2' })
    );
    await expect(
      aiGatewayInferenceLogService.list({ instance }).run({ limit: 1, before: 'aglg_2' })
    ).rejects.toThrow(/forward/);
  });

  it('hides inference logs recorded for another gateway instance', async () => {
    mocks.gateway.inferenceLog.get.mockResolvedValue({ id: 'aglg_1', instanceId: 'agin_2' });

    await expect(
      aiGatewayInferenceLogService.get({ instance, inferenceLogId: 'aglg_1' })
    ).rejects.toThrow();
  });
});
