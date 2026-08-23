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
      chat: createModel(),
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
  registerAdapterListener: vi.fn(),
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

vi.mock('./queues/sync', () => ({
  enqueueSyncChatWorkspacesForProvider: vi.fn()
}));

import {
  projectChatFromAdapterIntegration,
  upsertChatInstanceProviderProjection
} from './lib/project';
import { enqueueSyncChatWorkspacesForProvider } from './queues/sync';

describe('chat projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.chatIntegration.findUnique.mockResolvedValue(null);
    tx.chatIntegration.create.mockResolvedValue({ oid: 500n });
    tx.chatIntegration.updateMany.mockResolvedValue({ count: 1 });
    tx.chatIntegrationProvider.updateMany.mockResolvedValue({ count: 0 });
    tx.chatIntegrationInstance.updateMany.mockResolvedValue({ count: 0 });
    tx.chatIntegrationInstanceProvider.updateMany.mockResolvedValue({ count: 0 });
    tx.chat.updateMany.mockResolvedValue({ count: 0 });
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
    expect(tx.chat.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'archived',
          isParentDeleted: true
        })
      })
    );
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

describe('upsertChatInstanceProviderProjection workspace sync', () => {
  let adapterInstanceProvider = {
    oid: 90n,
    status: 'active',
    adapterIntegrationInstanceOid: 300n,
    adapterIntegrationProviderOid: 40n,
    adapterIntegrationOid: 100n,
    tenantOid: 1n,
    projectOid: 11n,
    environmentOid: 3n,
    instanceOid: 33n,
    solutionOid: 2
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tx.chatIntegrationInstance.findUnique.mockResolvedValue({ oid: 70n, id: 'cii_1' });
    tx.chatIntegrationProvider.findUnique.mockResolvedValue({ oid: 40n, name: 'Slack' });
    tx.chatIntegration.findUnique.mockResolvedValue({ oid: 10n });
  });

  it('enqueues workspace sync when an instance provider is created', async () => {
    tx.chatIntegrationInstanceProvider.findUnique.mockResolvedValue(null);
    tx.chatIntegrationInstanceProvider.create.mockResolvedValue({ id: 'ciip_new' });

    await upsertChatInstanceProviderProjection(adapterInstanceProvider as any);

    expect(enqueueSyncChatWorkspacesForProvider).toHaveBeenCalledWith('ciip_new');
  });

  it('enqueues workspace sync when an archived instance provider is restored', async () => {
    tx.chatIntegrationInstanceProvider.findUnique.mockResolvedValue({
      oid: 80n,
      id: 'ciip_1',
      status: 'archived'
    });
    tx.chatIntegrationInstanceProvider.update.mockResolvedValue({ id: 'ciip_1' });

    await upsertChatInstanceProviderProjection(adapterInstanceProvider as any);

    expect(enqueueSyncChatWorkspacesForProvider).toHaveBeenCalledWith('ciip_1');
    expect(tx.chat.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'active',
          isParentDeleted: false
        })
      })
    );
  });

  it('does not enqueue workspace sync when the instance provider is already active', async () => {
    tx.chatIntegrationInstanceProvider.findUnique.mockResolvedValue({
      oid: 80n,
      id: 'ciip_1',
      status: 'active'
    });
    tx.chatIntegrationInstanceProvider.update.mockResolvedValue({ id: 'ciip_1' });

    await upsertChatInstanceProviderProjection(adapterInstanceProvider as any);

    expect(enqueueSyncChatWorkspacesForProvider).not.toHaveBeenCalled();
  });
});
