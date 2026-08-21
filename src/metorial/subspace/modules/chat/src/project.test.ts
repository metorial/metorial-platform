import { beforeEach, describe, expect, it, vi } from 'vitest';

let { tx } = vi.hoisted(() => {
  let createModel = () => ({
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  });

  return {
    tx: {
      adapterIntegration: createModel(),
      adapterIntegrationProvider: createModel(),
      adapterIntegrationInstance: createModel(),
      adapterIntegrationInstanceProvider: createModel(),
      chatIntegration: createModel(),
      chatIntegrationProvider: createModel(),
      chatIntegrationInstance: createModel(),
      chatIntegrationInstanceProvider: createModel(),
      integration: createModel(),
      integrationProvider: createModel(),
      integrationInstance: createModel()
    }
  };
});

vi.mock('@metorial-subspace/db', () => ({
  getId: (kind: string) => ({ id: `${kind}_new`, oid: 500n }),
  withTransaction: async (cb: (db: any) => Promise<any>) => await cb(tx),
  addAfterTransactionHook: async (hook: () => any) => await hook()
}));

vi.mock('@metorial-subspace/module-integration', () => ({
  registerIntegrationTransactionListener: vi.fn(),
  isLiveAdapterStatus: (status: string) => status === 'active',
  isLiveAdapterInstanceStatus: (status: string) => status === 'draft' || status === 'active'
}));

vi.mock('./queues/lifecycle', () => ({
  enqueueChatIntegrationArchived: vi.fn(),
  enqueueChatIntegrationCreated: vi.fn(),
  enqueueChatIntegrationUpdated: vi.fn(),
  enqueueChatIntegrationInstanceArchived: vi.fn(),
  enqueueChatIntegrationInstanceCreated: vi.fn(),
  enqueueChatIntegrationInstanceUpdated: vi.fn()
}));

import { projectChatFromAdapterIntegration } from './lib/project';

describe('chat projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.chatIntegration.findUnique.mockResolvedValue(null);
    tx.chatIntegration.create.mockResolvedValue({ oid: 500n });
    tx.chatIntegration.updateMany.mockResolvedValue({ count: 1 });
    tx.chatIntegrationProvider.updateMany.mockResolvedValue({ count: 0 });
    tx.chatIntegrationInstance.updateMany.mockResolvedValue({ count: 0 });
    tx.chatIntegrationInstanceProvider.updateMany.mockResolvedValue({ count: 0 });
    tx.adapterIntegrationProvider.findMany.mockResolvedValue([]);
    tx.adapterIntegrationInstance.findMany.mockResolvedValue([]);
    tx.integration.findUniqueOrThrow.mockResolvedValue({ name: 'Support' });
  });

  it('creates a chat integration for a live adapter link', async () => {
    await projectChatFromAdapterIntegration({
      oid: 100n,
      status: 'active',
      integrationOid: 20n,
      tenantOid: 1n,
      projectOid: 11n,
      environmentOid: 3n,
      instanceOid: 33n,
      solutionOid: 2
    } as any);

    expect(tx.chatIntegration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Support',
          adapterIntegrationOid: 100n
        })
      })
    );
  });

  it('archives chat rows when the adapter integration is archived', async () => {
    await projectChatFromAdapterIntegration({
      oid: 100n,
      status: 'archived',
      integrationOid: 20n
    } as any);

    expect(tx.chatIntegration.updateMany).toHaveBeenCalled();
    expect(tx.chatIntegration.create).not.toHaveBeenCalled();
  });

  it('projects draft instance status from the adapter instance', async () => {
    tx.chatIntegration.findUnique.mockResolvedValue({ oid: 500n, status: 'active' });
    tx.adapterIntegrationInstance.findMany.mockResolvedValue([
      {
        oid: 300n,
        status: 'draft',
        adapterIntegrationOid: 100n,
        integrationInstanceOid: 40n,
        tenantOid: 1n,
        projectOid: 11n,
        environmentOid: 3n,
        instanceOid: 33n,
        solutionOid: 2
      }
    ]);
    tx.adapterIntegrationInstanceProvider.findMany.mockResolvedValue([]);
    tx.chatIntegrationInstance.findUnique.mockResolvedValue(null);
    tx.integrationInstance.findUnique.mockResolvedValue({
      name: 'Bot',
      description: null
    });
    tx.chatIntegrationInstance.create.mockResolvedValue({ oid: 700n });

    await projectChatFromAdapterIntegration({
      oid: 100n,
      status: 'active',
      integrationOid: 20n,
      tenantOid: 1n,
      projectOid: 11n,
      environmentOid: 3n,
      instanceOid: 33n,
      solutionOid: 2
    } as any);

    expect(tx.chatIntegrationInstance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'draft' })
      })
    );
  });
});
