import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  db,
  getChatAdapterClientInternal,
  persistMessageResult,
  hydrateChatMessageAttachments,
  resolveCommandInvocation
} = vi.hoisted(() => ({
  db: {
    chatChannel: { findFirst: vi.fn() },
    chatMessageAttachment: { findMany: vi.fn() }
  },
  getChatAdapterClientInternal: vi.fn(),
  persistMessageResult: vi.fn(),
  hydrateChatMessageAttachments: vi.fn(),
  resolveCommandInvocation: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({ build: () => factory() }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({ db }));
vi.mock('@metorial/db', () => ({ db: {} }));
vi.mock('@metorial/module-file', () => ({}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  resolveMetorialFacing: vi.fn()
}));

vi.mock('../lib/chatLock', () => ({
  usingChatMessageLock: (_chatOid: bigint, fn: () => Promise<unknown>) => fn()
}));

vi.mock('../internal/chatAdapter', () => ({
  chatAdapterService: { getChatAdapterClientInternal }
}));

vi.mock('../internal/chatMessage', () => ({
  chatMessageServiceInternal: { persistMessageResult }
}));

vi.mock('../internal/chatMessageAttachment', () => ({
  chatMessageAttachmentInternalService: { hydrateChatMessageAttachments }
}));

vi.mock('../internal/chatEvent', () => ({
  chatEventInternalService: { resolveCommandInvocation }
}));

vi.mock('../internal/chatChannel', () => ({ chatChannelServiceInternal: {} }));
vi.mock('../internal/chatThread', () => ({ chatThreadServiceInternal: {} }));
vi.mock('../internal/chatMessageGroup', () => ({
  chatMessageGroupServiceInternal: {},
  messageHasTextContent: vi.fn()
}));

import { chatMessageService } from './chatMessage';

let tenant = { oid: 1n } as any;
let environment = { oid: 2n } as any;
let chat = { oid: 3n, chatInstanceProvider: { oid: 4n } } as any;
let localChannel = { oid: 50n, id: 'cch_1', channelId: 'C1' };

let success = (output: unknown) => ({ result: { type: 'success', output } });

let mockClient = (output: unknown, capable = true) => {
  let client = {
    isCapabilityAvailable: vi.fn(() => capable),
    call: vi.fn().mockResolvedValue(success(output))
  };
  getChatAdapterClientInternal.mockResolvedValue(client);
  return client;
};

let respond = (overrides: Record<string, unknown> = {}) =>
  chatMessageService.respondToChatCommandInternal({
    tenant,
    environment,
    chat,
    chatEventId: 'chevt_1',
    body: { parts: [{ type: 'text', content: 'hi' }] },
    ...overrides
  });

describe('chatMessageService.respondToChatCommandInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.chatChannel.findFirst.mockResolvedValue(null);
    resolveCommandInvocation.mockResolvedValue({
      responseToken: 'token_1',
      channel: null,
      channelId: 'C1',
      threadId: undefined
    });
    db.chatMessageAttachment.findMany.mockResolvedValue([]);
    hydrateChatMessageAttachments.mockResolvedValue([]);
  });

  it('rejects providers without native command responses', async () => {
    let client = mockClient({}, false);

    await expect(respond()).rejects.toThrow(/does not support responding to commands/);
    expect(resolveCommandInvocation).not.toHaveBeenCalled();
    expect(client.call).not.toHaveBeenCalled();
  });

  it('responds with the token and location resolved from the command event', async () => {
    let client = mockClient({ raw: {} });
    resolveCommandInvocation.mockResolvedValue({
      responseToken: 'token_1',
      channel: localChannel,
      channelId: 'C1',
      threadId: '1700.1'
    });

    await respond({ ephemeral: true });

    expect(resolveCommandInvocation).toHaveBeenCalledWith({
      tenant,
      chat,
      chatEventId: 'chevt_1'
    });
    expect(client.call).toHaveBeenCalledWith('metorial_chat$command.respond', {
      parts: [{ type: 'text', content: 'hi' }],
      altText: undefined,
      responseToken: 'token_1',
      channelId: 'C1',
      threadId: '1700.1',
      ephemeral: true
    });
  });

  it('returns null when the provider does not identify the response message', async () => {
    mockClient({ raw: { ok: true } });

    await expect(respond()).resolves.toBeNull();
    expect(persistMessageResult).not.toHaveBeenCalled();
  });

  it('stores the response message the provider returns', async () => {
    let message = { messageId: 'M1', channelId: 'C1' };
    let channel = { id: 'C1' };
    mockClient({ message, channel, raw: {} });
    persistMessageResult.mockResolvedValue({ oid: 70n, id: 'cms_1' });

    let result = await respond();

    expect(persistMessageResult).toHaveBeenCalledWith(
      expect.objectContaining({
        localChannel: null,
        result: { message, channel, thread: undefined }
      })
    );
    expect(result).toEqual({ oid: 70n, id: 'cms_1', attachments: [] });
  });

  it('does not fail a delivered response it cannot place in a channel', async () => {
    mockClient({ message: { messageId: 'M1', channelId: 'C9' }, raw: {} });

    await expect(respond()).resolves.toBeNull();
    expect(db.chatChannel.findFirst).toHaveBeenCalledWith({
      where: { chatOid: 3n, channelId: 'C9' }
    });
    expect(persistMessageResult).not.toHaveBeenCalled();
  });
});
