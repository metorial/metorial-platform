import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cursor } from '@lowerdeck/pagination';
import { ServiceError } from '@lowerdeck/error';

let { db, getChatAdapterClientInternal, upsertChatWorkspaces, upsertChatWorkspace } = vi.hoisted(
  () => {
    let createModel = () => ({
      findFirst: vi.fn()
    });

    return {
      db: {
        chatWorkspace: createModel()
      },
      getChatAdapterClientInternal: vi.fn(),
      upsertChatWorkspaces: vi.fn(),
      upsertChatWorkspace: vi.fn()
    };
  }
);

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  resolveMetorialFacing: vi.fn()
}));

vi.mock('../internal/chatAdapter', () => ({
  chatAdapterService: {
    getChatAdapterClientInternal
  },
  chatAdapterWorkerClient: { identifier: 'worker', name: 'Worker' }
}));

vi.mock('../internal/chatWorkspace', () => ({
  chatWorkspaceInternalService: {
    upsertChatWorkspaces,
    upsertChatWorkspace
  }
}));

import { chatWorkspaceService } from './chatWorkspace';

let tenant = { oid: 1n } as any;
let environment = { oid: 3n } as any;
let provider = { oid: 80n, id: 'ciip_1', status: 'active' } as any;

describe('chatWorkspaceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty list when workspace_read is not advertised', async () => {
    let call = vi.fn();
    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => false,
      call
    });

    let paginator = await chatWorkspaceService.listChatWorkspacesInternal({
      tenant,
      environment,
      chatIntegrationInstanceProvider: provider
    });
    let list = await paginator.run({});

    expect(call).not.toHaveBeenCalled();
    expect(upsertChatWorkspaces).not.toHaveBeenCalled();
    expect(list.items).toEqual([]);
    expect(list.pagination.hasNextPage).toBe(false);
  });

  it('lists from the adapter, upserts, and encodes adapter cursors', async () => {
    let chat = { oid: 500n, name: 'Acme', status: 'active' };
    let workspace = { oid: 8n, id: 'cws_1', workspaceId: 'T123', name: 'Acme' };
    upsertChatWorkspaces.mockResolvedValue([{ chat, workspace }]);

    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => true,
      call: vi.fn(async () => ({
        result: {
          type: 'success',
          output: {
            workspaces: [{ id: 'T123', name: 'Acme' }],
            nextCursor: 'adapter-next',
            prevCursor: 'adapter-prev'
          }
        }
      }))
    });

    let paginator = await chatWorkspaceService.listChatWorkspacesInternal({
      tenant,
      environment,
      chatIntegrationInstanceProvider: provider,
      search: 'acme'
    });
    let list = await paginator.run({ limit: 10 });

    expect(upsertChatWorkspaces).toHaveBeenCalledWith({
      chatIntegrationInstanceProvider: provider,
      workspaces: [{ id: 'T123', name: 'Acme' }]
    });
    expect(list.items[0]).toEqual({ ...workspace, chat });
    expect(list.pagination.after).toBe(Cursor.fromId('adapter-next', 'after').toString());
    expect(list.pagination.before).toBe(Cursor.fromId('adapter-prev', 'before').toString());
  });

  it('throws when adapter list fails', async () => {
    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => true,
      call: vi.fn(async () => ({
        result: { type: 'failure', output: { message: 'provider down' } }
      }))
    });

    let paginator = await chatWorkspaceService.listChatWorkspacesInternal({
      tenant,
      environment,
      chatIntegrationInstanceProvider: provider
    });

    let error = await paginator.run({}).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ServiceError);
  });

  it('returns 404 when getting a workspace without workspace_read', async () => {
    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => false,
      call: vi.fn()
    });

    let error = await chatWorkspaceService
      .getChatWorkspaceInternal({
        tenant,
        environment,
        chatIntegrationInstanceProvider: provider,
        workspaceId: 'T123'
      })
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ServiceError);
    expect(upsertChatWorkspace).not.toHaveBeenCalled();
  });

  it('passes through get to the adapter and upserts the result', async () => {
    let chat = { oid: 500n, name: 'Acme', status: 'active' };
    let workspace = { oid: 8n, id: 'cws_1', workspaceId: 'T123', name: 'Acme' };
    db.chatWorkspace.findFirst.mockResolvedValue(null);
    upsertChatWorkspace.mockResolvedValue({ chat, workspace });

    let call = vi.fn(async () => ({
      result: {
        type: 'success',
        output: { workspace: { id: 'T123', name: 'Acme' } }
      }
    }));
    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => true,
      call
    });

    let result = await chatWorkspaceService.getChatWorkspaceInternal({
      tenant,
      environment,
      chatIntegrationInstanceProvider: provider,
      workspaceId: 'T123'
    });

    expect(call).toHaveBeenCalledWith('metorial_chat$workspace.get', { workspaceId: 'T123' });
    expect(upsertChatWorkspace).toHaveBeenCalledWith({
      chatIntegrationInstanceProvider: provider,
      workspace: { id: 'T123', name: 'Acme' }
    });
    expect(result).toEqual({ ...workspace, chat });
  });

  it('resolves a local workspace id before calling the adapter', async () => {
    db.chatWorkspace.findFirst.mockResolvedValue({
      id: 'cws_1',
      workspaceId: 'T123'
    });
    upsertChatWorkspace.mockResolvedValue({
      chat: { oid: 500n },
      workspace: { oid: 8n, id: 'cws_1', workspaceId: 'T123' }
    });

    let call = vi.fn(async () => ({
      result: {
        type: 'success',
        output: { workspace: { id: 'T123', name: 'Acme' } }
      }
    }));
    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => true,
      call
    });

    await chatWorkspaceService.getChatWorkspaceInternal({
      tenant,
      environment,
      chatIntegrationInstanceProvider: provider,
      workspaceId: 'cws_1'
    });

    expect(call).toHaveBeenCalledWith('metorial_chat$workspace.get', { workspaceId: 'T123' });
  });

  it('returns 404 when adapter get fails', async () => {
    db.chatWorkspace.findFirst.mockResolvedValue(null);
    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => true,
      call: vi.fn(async () => ({
        result: { type: 'failure', output: { message: 'missing' } }
      }))
    });

    let error = await chatWorkspaceService
      .getChatWorkspaceInternal({
        tenant,
        environment,
        chatIntegrationInstanceProvider: provider,
        workspaceId: 'T999'
      })
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ServiceError);
    expect(upsertChatWorkspace).not.toHaveBeenCalled();
  });
});
