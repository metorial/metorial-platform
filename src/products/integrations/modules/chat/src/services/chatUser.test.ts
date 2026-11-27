import { beforeEach, describe, expect, it, vi } from 'vitest';

let { getChatAdapterClientInternal, resolveChatForAuthorLink, upsertChatAuthors } = vi.hoisted(
  () => ({
    getChatAdapterClientInternal: vi.fn(),
    resolveChatForAuthorLink: vi.fn(),
    upsertChatAuthors: vi.fn()
  })
);

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

vi.mock('../internal/chatAdapter', () => ({
  chatAdapterService: {
    getChatAdapterClientInternal
  }
}));

vi.mock('../internal/chatAuthor', () => ({
  chatAuthorServiceInternal: {
    upsertChatAuthors
  }
}));

vi.mock('../internal/chatWorkspace', () => ({
  chatWorkspaceInternalService: {
    resolveChatForAuthorLink
  }
}));

import { chatUserService } from './chatUser';

let tenant = { oid: 1n } as any;
let environment = { oid: 3n } as any;
let provider = { oid: 80n, id: 'ciip_1', status: 'active' } as any;

describe('chatUserService.getAuthenticatedChatUserInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('links the author to the workspace chat when the adapter returns a workspace', async () => {
    let author = { userId: 'U1', userName: 'bot', isMe: true, raw: {} };
    let workspace = { id: 'T1', name: 'Acme' };
    let chat = { oid: 500n };
    let linkedAuthor = { oid: 900n, userId: 'U1' };

    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => true,
      call: vi.fn(async () => ({
        result: { type: 'success', output: { author, workspace } }
      }))
    });
    resolveChatForAuthorLink.mockResolvedValue({ chat, workspace: { oid: 8n, workspaceId: 'T1' } });
    upsertChatAuthors.mockResolvedValue([linkedAuthor]);

    let result = await chatUserService.getAuthenticatedChatUserInternal({
      tenant,
      environment,
      chatInstanceProvider: provider
    });

    expect(resolveChatForAuthorLink).toHaveBeenCalledWith({
      chatInstanceProvider: provider,
      workspace
    });
    expect(upsertChatAuthors).toHaveBeenCalledWith({ chat, authors: [author] });
    expect(result.author).toBe(linkedAuthor);
    expect(result.workspace).toEqual({ oid: 8n, workspaceId: 'T1' });
  });

  it('falls back to an existing chat and still links when the adapter returns no workspace', async () => {
    let author = { userId: 'U1', userName: 'bot', isMe: true, raw: {} };
    let chat = { oid: 500n };
    let linkedAuthor = { oid: 900n, userId: 'U1' };

    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => true,
      call: vi.fn(async () => ({
        result: { type: 'success', output: { author, workspace: undefined } }
      }))
    });
    resolveChatForAuthorLink.mockResolvedValue({ chat, workspace: null });
    upsertChatAuthors.mockResolvedValue([linkedAuthor]);

    let result = await chatUserService.getAuthenticatedChatUserInternal({
      tenant,
      environment,
      chatInstanceProvider: provider
    });

    expect(resolveChatForAuthorLink).toHaveBeenCalledWith({
      chatInstanceProvider: provider,
      workspace: undefined
    });
    expect(upsertChatAuthors).toHaveBeenCalledWith({ chat, authors: [author] });
    expect(result.author).toBe(linkedAuthor);
    expect(result.workspace).toBeNull();
  });

  it('returns the raw author unpersisted when no chat can be resolved', async () => {
    let author = { userId: 'U1', userName: 'bot', isMe: true, raw: {} };

    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => true,
      call: vi.fn(async () => ({
        result: { type: 'success', output: { author, workspace: undefined } }
      }))
    });
    resolveChatForAuthorLink.mockResolvedValue(null);

    let result = await chatUserService.getAuthenticatedChatUserInternal({
      tenant,
      environment,
      chatInstanceProvider: provider
    });

    expect(upsertChatAuthors).not.toHaveBeenCalled();
    expect(result.author).toBe(author);
    expect(result.workspace).toBeNull();
  });
});
