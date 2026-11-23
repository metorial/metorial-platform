import { beforeEach, describe, expect, it, vi } from 'vitest';

let { recordEvent, addAfterTransactionHook } = vi.hoisted(() => ({
  recordEvent: vi.fn(),
  addAfterTransactionHook: vi.fn(async (hook: () => Promise<void>) => await hook())
}));

vi.mock('@metorial/module-audit-tracker', () => ({
  auditTrackerService: { recordEvent }
}));

vi.mock('@metorial/db', () => ({ addAfterTransactionHook }));

vi.mock('@metorial/fabric', () => ({
  Fabric: { listen: vi.fn() }
}));

import {
  recordAiGatewayConfigUpdated,
  recordAiGatewayProviderConnectionArchived,
  recordAiGatewayTokenCreated,
  recordAiGatewayTokenRevoked,
  recordAiGatewayVirtualModelUpdated
} from './aiGateway';

let auditScope = {
  organizationOid: 1n,
  instanceOid: 3n,
  organizationActorOid: 4n,
  actor: { type: 'org_actor' as const, id: 'oac_1' },
  context: { ip: '127.0.0.1' }
};

let token = {
  id: 'agtk_1',
  name: 'Production',
  consumerRef: 'user_7',
  allowedModels: ['anthropic/claude-sonnet-4'],
  expiresAt: null,
  revokedAt: null
};

let virtualModel = {
  id: 'agvm_1',
  slug: 'support',
  name: 'Support',
  versionId: 'agvv_2',
  versionNumber: 2
};

describe('ai gateway audit listeners', () => {
  beforeEach(() => {
    recordEvent.mockClear();
  });

  it('records config updates with the previous config', async () => {
    let config = {
      logRetentionDays: 30,
      settings: { fallbacks: { enabled: true } },
      limits: []
    };
    let previousConfig = { ...config, logRetentionDays: 7 };

    await recordAiGatewayConfigUpdated({ auditScope, config, previousConfig } as any);

    expect(recordEvent).toHaveBeenCalledWith(auditScope, 'ai_gateway_config', 'update', {
      payload: config,
      previousPayload: previousConfig,
      recordedAt: expect.any(Date)
    });
  });

  it('records token creation and revocation without the secret', async () => {
    await recordAiGatewayTokenCreated({ auditScope, token } as any);
    await recordAiGatewayTokenRevoked({
      auditScope,
      token: { ...token, revokedAt: new Date() }
    } as any);

    expect(recordEvent.mock.calls.map(call => call[2])).toEqual(['create', 'revoke']);
    expect(recordEvent.mock.calls[0]![3].payload).toEqual(token);
  });

  it('records archived provider connections as deletions', async () => {
    let connection = {
      id: 'agpc_1',
      name: 'OpenAI',
      providerSlug: 'openai',
      status: 'valid',
      priority: 0
    };

    await recordAiGatewayProviderConnectionArchived({ auditScope, connection } as any);

    expect(recordEvent).toHaveBeenCalledWith(
      auditScope,
      'ai_gateway_provider_connection',
      'delete',
      expect.objectContaining({ payload: connection })
    );
  });

  it('records virtual model updates with the previous version', async () => {
    await recordAiGatewayVirtualModelUpdated({
      auditScope,
      virtualModel,
      previousVirtualModel: { ...virtualModel, versionId: 'agvv_1', versionNumber: 1 }
    } as any);

    expect(recordEvent).toHaveBeenCalledWith(
      auditScope,
      'ai_gateway_virtual_model',
      'update',
      expect.objectContaining({
        payload: expect.objectContaining({ versionNumber: 2 }),
        previousPayload: expect.objectContaining({ versionNumber: 1 })
      })
    );
  });
});
