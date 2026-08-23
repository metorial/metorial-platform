import { beforeEach, describe, expect, it, vi } from 'vitest';

let { resolveAdapterInstanceProviderSession, createChatAdapterClient } = vi.hoisted(() => ({
  resolveAdapterInstanceProviderSession: vi.fn(),
  createChatAdapterClient: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  resolveMetorialFacing: vi.fn()
}));

vi.mock('@metorial-subspace/module-integration', () => ({
  resolveAdapterInstanceProviderSession
}));

vi.mock('@metorial-subspace/adapter-chat', () => ({
  ChatAdapterClient: { create: createChatAdapterClient }
}));

import { chatAdapterService } from './chatAdapter';

let tenant = { oid: 1n } as any;
let environment = { oid: 3n } as any;

describe('chatAdapterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAdapterInstanceProviderSession.mockResolvedValue({ id: 'ses_1', oid: 1000n });
    createChatAdapterClient.mockResolvedValue({ call: vi.fn() });
  });

  it('resolves an adapter session and returns a chat adapter client', async () => {
    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant,
      environment,
      chatIntegrationInstanceProvider: {
        oid: 80n,
        status: 'active',
        adapterIntegrationInstanceProviderOid: 10n,
        tenantOid: 1n
      } as any
    });

    expect(resolveAdapterInstanceProviderSession).toHaveBeenCalledWith({
      tenant,
      environment,
      adapterInstanceProvider: { oid: 10n }
    });
    expect(createChatAdapterClient).toHaveBeenCalledWith({
      tenant,
      environment,
      session: { id: 'ses_1', oid: 1000n },
      // Fixed by the service, not supplied by the caller: every chat tool call
      // shares one internal connection identity.
      client: { identifier: 'chat_providers', name: 'Metorial - Chat Providers' }
    });
    expect(client).toEqual({ call: expect.any(Function) });
  });

  it('rejects archived chat integration instance providers', async () => {
    let error = await chatAdapterService
      .getChatAdapterClientInternal({
        tenant,
        environment,
        chatIntegrationInstanceProvider: {
          oid: 80n,
          status: 'archived',
          adapterIntegrationInstanceProviderOid: 10n,
          tenantOid: 1n
        } as any
      })
      .catch((err: any) => err);

    expect(error?.data?.code ?? error?.error?.code ?? String(error)).toMatch(
      /chat_integration_instance_provider_archived|archived/
    );
    expect(resolveAdapterInstanceProviderSession).not.toHaveBeenCalled();
  });
});
