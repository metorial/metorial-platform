import { chatError } from '@slates/adapter-chat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  db,
  queues,
  getChatAdapterClientInternal,
  resolveChatForAuthorLink,
  upsertChatAuthors
} = vi.hoisted(() => {
  let queues: Record<
    string,
    { add: ReturnType<typeof vi.fn>; addMany: ReturnType<typeof vi.fn> }
  > = {};

  return {
    db: {
      chatInstanceProvider: {
        findUnique: vi.fn()
      }
    },
    queues,
    getChatAdapterClientInternal: vi.fn(),
    resolveChatForAuthorLink: vi.fn(),
    upsertChatAuthors: vi.fn()
  };
});

vi.mock('@lowerdeck/queue', () => ({
  createQueue: vi.fn((opts: { name: string }) => {
    let q = queues[opts.name] ?? {
      add: vi.fn(),
      addMany: vi.fn()
    };
    queues[opts.name] = q;
    return {
      ...q,
      process: (fn: any) => fn
    };
  }),
  QueueRetryError: class QueueRetryError extends Error {}
}));

vi.mock('../../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost' } }
}));

vi.mock('@metorial-subspace/db', () => ({
  db,
  addAfterTransactionHook: async (hook: () => any) => await hook()
}));

vi.mock('../../internal/chatAdapter', () => ({
  chatAdapterService: {
    getChatAdapterClientInternal
  }
}));

vi.mock('../../internal/chatWorkspace', () => ({
  chatWorkspaceInternalService: {
    resolveChatForAuthorLink
  }
}));

vi.mock('../../internal/chatAuthor', () => ({
  chatAuthorServiceInternal: {
    upsertChatAuthors
  }
}));

import { syncChatInstanceProviderAuthorizationQueueProcessor } from './authorization';

type JobHandler<T> = (data: T) => Promise<void>;

let processSyncChatInstanceProviderAuthorization =
  syncChatInstanceProviderAuthorizationQueueProcessor as unknown as JobHandler<{
    chatInstanceProviderId: string;
  }>;

let providerQueue = 'sub/cht/sync/authorization';

let mockActiveProvider = () => {
  db.chatInstanceProvider.findUnique.mockResolvedValue({
    id: 'ciip_1',
    oid: 80n,
    status: 'active',
    isParentDeleted: false,
    chatInstance: { oid: 20n, status: 'active' },
    tenant: { oid: 1n },
    environment: { oid: 3n }
  });
};

let mockAdapterFailure = (error: unknown) => {
  getChatAdapterClientInternal.mockResolvedValue({
    isCapabilityAvailable: () => true,
    call: vi.fn(async () => ({
      result: { type: 'failure', output: JSON.parse(JSON.stringify(error)) }
    }))
  });
};

describe('sync chat instance provider authorization queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves the chat for the returned workspace and links the authenticated author to it', async () => {
    mockActiveProvider();
    let author = { userId: 'U1', userName: 'bot', type: 'app', isMe: true, raw: {} };
    let workspace = { id: 'T1', name: 'Acme' };
    let chat = { oid: 500n };
    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => true,
      call: vi.fn(async () => ({
        result: { type: 'success', output: { author, workspace } }
      }))
    });
    resolveChatForAuthorLink.mockResolvedValue({ chat, workspace: { oid: 8n } });

    await processSyncChatInstanceProviderAuthorization({ chatInstanceProviderId: 'ciip_1' });

    expect(resolveChatForAuthorLink).toHaveBeenCalledWith({
      chatInstanceProvider: expect.objectContaining({ id: 'ciip_1' }),
      workspace
    });
    expect(upsertChatAuthors).toHaveBeenCalledWith({
      chat,
      authors: [author]
    });
  });

  it('falls back to an existing chat when the adapter returns no workspace', async () => {
    mockActiveProvider();
    let author = { userId: 'U1', userName: 'bot', type: 'app', isMe: true, raw: {} };
    let chat = { oid: 500n };
    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => true,
      call: vi.fn(async () => ({
        result: { type: 'success', output: { author, workspace: undefined } }
      }))
    });
    resolveChatForAuthorLink.mockResolvedValue({ chat, workspace: null });

    await processSyncChatInstanceProviderAuthorization({ chatInstanceProviderId: 'ciip_1' });

    expect(resolveChatForAuthorLink).toHaveBeenCalledWith({
      chatInstanceProvider: expect.objectContaining({ id: 'ciip_1' }),
      workspace: undefined
    });
    expect(upsertChatAuthors).toHaveBeenCalledWith({
      chat,
      authors: [author]
    });
  });

  it('skips persisting when no workspace is given and no chat exists yet', async () => {
    mockActiveProvider();
    let author = { userId: 'U1', userName: 'bot', type: 'app', isMe: true, raw: {} };
    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => true,
      call: vi.fn(async () => ({
        result: { type: 'success', output: { author, workspace: undefined } }
      }))
    });
    resolveChatForAuthorLink.mockResolvedValue(null);

    await processSyncChatInstanceProviderAuthorization({ chatInstanceProviderId: 'ciip_1' });

    expect(upsertChatAuthors).not.toHaveBeenCalled();
  });

  it('skips providers that do not advertise user_self_read', async () => {
    mockActiveProvider();
    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => false,
      call: vi.fn()
    });

    await processSyncChatInstanceProviderAuthorization({ chatInstanceProviderId: 'ciip_1' });

    expect(upsertChatAuthors).not.toHaveBeenCalled();
  });

  it('retries a transient adapter failure', async () => {
    mockActiveProvider();
    mockAdapterFailure(chatError('chat.rate_limit.exceeded'));

    await expect(
      processSyncChatInstanceProviderAuthorization({ chatInstanceProviderId: 'ciip_1' })
    ).rejects.toBeInstanceOf(Error);

    expect(upsertChatAuthors).not.toHaveBeenCalled();
  });

  it('gives up on a terminal adapter failure instead of retrying', async () => {
    mockActiveProvider();
    mockAdapterFailure(chatError('chat.auth.missing_scope'));

    await expect(
      processSyncChatInstanceProviderAuthorization({ chatInstanceProviderId: 'ciip_1' })
    ).resolves.toBeUndefined();

    expect(upsertChatAuthors).not.toHaveBeenCalled();
    expect(queues[providerQueue]!.add).not.toHaveBeenCalled();
  });

  it('does nothing for an archived or parent-deleted provider', async () => {
    db.chatInstanceProvider.findUnique.mockResolvedValue({
      id: 'ciip_1',
      oid: 80n,
      status: 'archived',
      isParentDeleted: false,
      chatInstance: { oid: 20n, status: 'active' },
      tenant: { oid: 1n },
      environment: { oid: 3n }
    });

    await processSyncChatInstanceProviderAuthorization({ chatInstanceProviderId: 'ciip_1' });

    expect(getChatAdapterClientInternal).not.toHaveBeenCalled();
    expect(upsertChatAuthors).not.toHaveBeenCalled();
  });
});
