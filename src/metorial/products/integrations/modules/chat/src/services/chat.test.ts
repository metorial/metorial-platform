import { beforeEach, describe, expect, it, vi } from 'vitest';

let { tx, addManyWithOps } = vi.hoisted(() => {
  let createModel = () => ({
    findFirst: vi.fn(),
    findMany: vi.fn()
  });

  return {
    tx: {
      chat: createModel(),
      chatIntegrationInstanceProvider: createModel()
    },
    addManyWithOps: vi.fn()
  };
});

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: { create: vi.fn() }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: tx,
  withTransaction: async (cb: (db: any) => Promise<any>) => await cb(tx)
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: vi.fn(() => ({ hasParent: {} })),
  normalizeStatusForList: vi.fn(() => ({ hasParent: {} }))
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getMetorialSolution: vi.fn(async () => ({ oid: 2 })),
  resolveMetorialFacing: vi.fn()
}));

vi.mock('../queues/sync/workspaces', () => ({
  syncChatWorkspacesForProviderQueue: { addManyWithOps }
}));

import { chatService } from './chat';

let tenant = { oid: 1n } as any;
let environment = { oid: 3n } as any;

describe('chatService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues workspace sync for each active instance provider', async () => {
    tx.chatIntegrationInstanceProvider.findMany.mockResolvedValue([
      { id: 'ciip_1', status: 'active' },
      { id: 'ciip_2', status: 'active' }
    ]);

    let result = await chatService.syncChatsInternal({
      tenant,
      environment,
      chatIntegrationInstance: { oid: 20n, tenantOid: 1n } as any
    });

    expect(tx.chatIntegrationInstanceProvider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          chatIntegrationInstanceOid: 20n,
          status: 'active',
          isParentDeleted: false
        })
      })
    );
    expect(addManyWithOps).toHaveBeenCalledWith([
      { data: { chatIntegrationInstanceProviderId: 'ciip_1' }, opts: { id: 'ws-sync-ciip_1' } },
      { data: { chatIntegrationInstanceProviderId: 'ciip_2' }, opts: { id: 'ws-sync-ciip_2' } }
    ]);
    expect(result.providers).toHaveLength(2);
  });

  it('does not enqueue when the instance has no active providers', async () => {
    tx.chatIntegrationInstanceProvider.findMany.mockResolvedValue([]);

    let result = await chatService.syncChatsInternal({
      tenant,
      environment,
      chatIntegrationInstance: { oid: 20n, tenantOid: 1n } as any
    });

    expect(addManyWithOps).toHaveBeenCalledWith([]);
    expect(result.providers).toEqual([]);
  });

  it('looks up a chat by id in the tenant scope', async () => {
    tx.chat.findFirst.mockResolvedValue({ id: 'cht_1', name: 'Acme' });

    let chat = await chatService.getChatByIdInternal({
      tenant,
      environment,
      chatId: 'cht_1'
    });

    expect(tx.chat.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'cht_1' })
      })
    );
    expect(chat.id).toBe('cht_1');
  });
});
