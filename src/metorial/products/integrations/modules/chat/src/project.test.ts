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
      chatConnection: createModel(),
      chatConnectionProvider: createModel(),
      chatInstance: createModel(),
      chatInstanceProvider: createModel(),
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
  enqueueChatConnectionArchived: vi.fn(),
  enqueueChatConnectionCreated: vi.fn(),
  enqueueChatConnectionUpdated: vi.fn(),
  enqueueChatInstanceArchived: vi.fn(),
  enqueueChatInstanceCreated: vi.fn(),
  enqueueChatInstanceUpdated: vi.fn()
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
    tx.chatConnection.findUnique.mockResolvedValue(null);
    tx.chatConnection.create.mockResolvedValue({ oid: 500n });
    tx.chatConnection.updateMany.mockResolvedValue({ count: 1 });
    tx.chatConnectionProvider.updateMany.mockResolvedValue({ count: 0 });
    tx.chatInstance.updateMany.mockResolvedValue({ count: 0 });
    tx.chatInstanceProvider.updateMany.mockResolvedValue({ count: 0 });
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

    expect(tx.chatConnection.create).toHaveBeenCalledWith(
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

    expect(tx.chatConnection.updateMany).toHaveBeenCalled();
    expect(tx.chat.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'archived',
          isParentDeleted: true
        })
      })
    );
    expect(tx.chatConnection.create).not.toHaveBeenCalled();
  });

  it('projects draft instance status from the adapter instance', async () => {
    tx.chatConnection.findUnique.mockResolvedValue({ oid: 500n, status: 'active' });
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
    tx.chatInstance.findUnique.mockResolvedValue(null);
    tx.integrationInstance.findUnique.mockResolvedValue({
      name: 'Bot',
      description: null
    });
    tx.chatInstance.create.mockResolvedValue({ oid: 700n });

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

    expect(tx.chatInstance.create).toHaveBeenCalledWith(
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
    tx.chatInstance.findUnique.mockResolvedValue({ oid: 70n, id: 'cii_1' });
    tx.chatConnectionProvider.findUnique.mockResolvedValue({ oid: 40n, name: 'Slack' });
    tx.chatConnection.findUnique.mockResolvedValue({ oid: 10n });
  });

  it('enqueues workspace sync when an instance provider is created', async () => {
    tx.chatInstanceProvider.findUnique.mockResolvedValue(null);
    tx.chatInstanceProvider.create.mockResolvedValue({ id: 'ciip_new' });

    await upsertChatInstanceProviderProjection(adapterInstanceProvider as any);

    expect(enqueueSyncChatWorkspacesForProvider).toHaveBeenCalledWith('ciip_new');
  });

  it('enqueues workspace sync when an archived instance provider is restored', async () => {
    tx.chatInstanceProvider.findUnique.mockResolvedValue({
      oid: 80n,
      id: 'ciip_1',
      status: 'archived'
    });
    tx.chatInstanceProvider.update.mockResolvedValue({ id: 'ciip_1' });

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
    tx.chatInstanceProvider.findUnique.mockResolvedValue({
      oid: 80n,
      id: 'ciip_1',
      status: 'active'
    });
    tx.chatInstanceProvider.update.mockResolvedValue({ id: 'ciip_1' });

    await upsertChatInstanceProviderProjection(adapterInstanceProvider as any);

    expect(enqueueSyncChatWorkspacesForProvider).not.toHaveBeenCalled();
  });
});
