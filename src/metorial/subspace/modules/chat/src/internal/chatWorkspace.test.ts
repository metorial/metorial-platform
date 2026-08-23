import { beforeEach, describe, expect, it, vi } from 'vitest';

let { tx } = vi.hoisted(() => {
  let createModel = () => ({
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  });

  return {
    tx: {
      chat: createModel(),
      chatWorkspace: createModel(),
      chatIntegrationInstanceProvider: createModel()
    }
  };
});

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/canonicalize', () => ({
  canonicalize: (value: unknown) => JSON.stringify(value)
}));

vi.mock('@lowerdeck/hash', () => ({
  Hash: {
    sha256: vi.fn(async (data: string) => `hash:${data}`)
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  getId: (kind: string) => ({ id: `${kind}_new`, oid: 500n }),
  withTransaction: async (cb: (db: any) => Promise<any>) => await cb(tx)
}));

import { chatWorkspaceInternalService } from './chatWorkspace';

let workspaceSyncHash = (payload: Record<string, unknown>) => `hash:${JSON.stringify(payload)}`;

let provider = {
  oid: 80n,
  id: 'ciip_1',
  status: 'active',
  chatIntegrationOid: 10n,
  chatIntegrationInstanceOid: 20n
} as any;

let binding = {
  adapterIntegrationProvider: {
    integrationProvider: {
      providerOid: 7n,
      provider: {
        providerAdapters: [{ oid: 99n, identifier: 'chat' }]
      }
    }
  }
};

describe('chatWorkspaceInternalService.upsertChatWorkspaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.chatWorkspace.findMany.mockResolvedValue([]);
    tx.chatIntegrationInstanceProvider.findUniqueOrThrow.mockResolvedValue(binding);
    tx.chat.create.mockResolvedValue({ oid: 500n, name: 'Acme', status: 'active' });
    tx.chatWorkspace.create.mockResolvedValue({
      oid: 8n,
      workspaceId: 'T123',
      name: 'Acme'
    });
  });

  it('creates chats and workspaces for new adapter workspaces', async () => {
    let result = await chatWorkspaceInternalService.upsertChatWorkspaces({
      chatIntegrationInstanceProvider: provider,
      workspaces: [
        {
          id: 'T123',
          name: 'Acme',
          domain: 'acme.slack.com',
          imageUrl: 'https://img',
          raw: { team: 'T123' }
        }
      ]
    });

    expect(tx.chatIntegrationInstanceProvider.findUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(tx.chat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'active',
          name: 'Acme',
          chatIntegrationInstanceProviderOid: 80n,
          adapterOid: 99n,
          providerOid: 7n
        })
      })
    );
    expect(tx.chatWorkspace.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'T123',
          name: 'Acme',
          domain: 'acme.slack.com',
          imageUrl: 'https://img',
          syncHash: workspaceSyncHash({
            name: 'Acme',
            domain: 'acme.slack.com',
            imageUrl: 'https://img',
            raw: { team: 'T123' }
          }),
          chatOid: 500n,
          chatIntegrationInstanceProviderOid: 80n
        })
      })
    );
    expect(result[0]!.chat.oid).toBe(500n);
    expect(result[0]!.workspace.workspaceId).toBe('T123');
  });

  it('resolves the adapter binding once for multiple creates', async () => {
    tx.chat.create
      .mockResolvedValueOnce({ oid: 500n, name: 'Acme', status: 'active' })
      .mockResolvedValueOnce({ oid: 501n, name: 'Beta', status: 'active' });
    tx.chatWorkspace.create
      .mockResolvedValueOnce({ oid: 8n, workspaceId: 'T123', name: 'Acme' })
      .mockResolvedValueOnce({ oid: 9n, workspaceId: 'T456', name: 'Beta' });

    await chatWorkspaceInternalService.upsertChatWorkspaces({
      chatIntegrationInstanceProvider: provider,
      workspaces: [
        { id: 'T123', name: 'Acme' },
        { id: 'T456', name: 'Beta' }
      ]
    });

    expect(tx.chatIntegrationInstanceProvider.findUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(tx.chat.create).toHaveBeenCalledTimes(2);
    expect(tx.chatWorkspace.create).toHaveBeenCalledTimes(2);
  });

  it('skips writes when chat and workspace payloads are unchanged', async () => {
    tx.chatWorkspace.findMany.mockResolvedValue([
      {
        oid: 8n,
        chatOid: 500n,
        workspaceId: 'T123',
        name: 'Acme',
        domain: null,
        imageUrl: null,
        raw: {},
        syncHash: workspaceSyncHash({
          name: 'Acme',
          domain: null,
          imageUrl: null,
          raw: {}
        }),
        chat: {
          oid: 500n,
          status: 'active',
          name: 'Acme',
          archivedAt: null,
          isParentDeleted: false
        }
      }
    ]);

    let result = await chatWorkspaceInternalService.upsertChatWorkspaces({
      chatIntegrationInstanceProvider: provider,
      workspaces: [{ id: 'T123', name: 'Acme' }]
    });

    expect(tx.chat.create).not.toHaveBeenCalled();
    expect(tx.chat.update).not.toHaveBeenCalled();
    expect(tx.chatWorkspace.create).not.toHaveBeenCalled();
    expect(tx.chatWorkspace.update).not.toHaveBeenCalled();
    expect(tx.chatIntegrationInstanceProvider.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(result[0]!.workspace.workspaceId).toBe('T123');
  });

  it('updates when the workspace name or raw payload changes', async () => {
    tx.chatWorkspace.findMany.mockResolvedValue([
      {
        oid: 8n,
        chatOid: 500n,
        workspaceId: 'T123',
        name: 'Acme',
        domain: null,
        imageUrl: null,
        raw: { team: 'old' },
        chat: {
          oid: 500n,
          status: 'active',
          name: 'Acme',
          archivedAt: null,
          isParentDeleted: false
        }
      }
    ]);
    tx.chatWorkspace.update.mockResolvedValue({
      oid: 8n,
      workspaceId: 'T123',
      name: 'Acme',
      raw: { team: 'new' }
    });
    tx.chat.update.mockResolvedValue({
      oid: 500n,
      status: 'active',
      name: 'Acme',
      archivedAt: null,
      isParentDeleted: false
    });

    await chatWorkspaceInternalService.upsertChatWorkspaces({
      chatIntegrationInstanceProvider: provider,
      workspaces: [{ id: 'T123', name: 'Acme', raw: { team: 'new' } }]
    });

    expect(tx.chat.update).toHaveBeenCalledWith({
      where: { oid: 500n },
      data: {
        name: 'Acme',
        status: 'active',
        archivedAt: null,
        isParentDeleted: false
      }
    });
    expect(tx.chatWorkspace.update).toHaveBeenCalledWith({
      where: { oid: 8n },
      data: {
        name: 'Acme',
        domain: null,
        imageUrl: null,
        raw: { team: 'new' },
        syncHash: workspaceSyncHash({
          name: 'Acme',
          domain: null,
          imageUrl: null,
          raw: { team: 'new' }
        })
      }
    });
  });

  it('skips deleted chats and does not rewrite the workspace', async () => {
    tx.chatWorkspace.findMany.mockResolvedValue([
      {
        oid: 8n,
        chatOid: 500n,
        workspaceId: 'T123',
        chat: { oid: 500n, status: 'deleted' }
      }
    ]);

    let result = await chatWorkspaceInternalService.upsertChatWorkspaces({
      chatIntegrationInstanceProvider: provider,
      workspaces: [{ id: 'T123', name: 'Acme' }]
    });

    expect(tx.chat.update).not.toHaveBeenCalled();
    expect(tx.chatWorkspace.update).not.toHaveBeenCalled();
    expect(tx.chatWorkspace.create).not.toHaveBeenCalled();
    expect(result[0]!.chat.status).toBe('deleted');
    expect(result[0]!.workspace.workspaceId).toBe('T123');
  });
});

describe('chatWorkspaceInternalService.upsertChatWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.chatWorkspace.findMany.mockResolvedValue([]);
    tx.chatIntegrationInstanceProvider.findUniqueOrThrow.mockResolvedValue(binding);
    tx.chat.create.mockResolvedValue({ oid: 500n, name: 'Acme', status: 'active' });
    tx.chatWorkspace.create.mockResolvedValue({
      oid: 8n,
      workspaceId: 'T123',
      name: 'Acme'
    });
  });

  it('delegates to upsertChatWorkspaces for a single workspace', async () => {
    let result = await chatWorkspaceInternalService.upsertChatWorkspace({
      chatIntegrationInstanceProvider: provider,
      workspace: {
        id: 'T123',
        name: 'Acme',
        domain: 'acme.slack.com',
        imageUrl: 'https://img',
        raw: { team: 'T123' }
      }
    });

    expect(tx.chatWorkspace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: { in: ['T123'] }
        })
      })
    );
    expect(tx.chat.create).toHaveBeenCalled();
    expect(tx.chatWorkspace.create).toHaveBeenCalled();
    expect(result.chat.oid).toBe(500n);
    expect(result.workspace.workspaceId).toBe('T123');
  });
});
