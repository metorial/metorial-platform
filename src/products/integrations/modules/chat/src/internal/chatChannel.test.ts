import { beforeEach, describe, expect, it, vi } from 'vitest';

let { tx, upsertChatAuthors } = vi.hoisted(() => ({
  tx: {
    chatChannel: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    chatWorkspace: { findMany: vi.fn() }
  },
  upsertChatAuthors: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  getId: () => ({ id: 'cch_new', oid: 500n }),
  withTransaction: async (cb: (db: any) => Promise<any>) => await cb(tx)
}));

vi.mock('./chatAuthor', () => ({
  chatAuthorServiceInternal: { upsertChatAuthors }
}));

vi.mock('../queues/search/chatChannel', () => ({
  enqueueIndexChatChannels: vi.fn()
}));

import { chatChannelServiceInternal } from './chatChannel';

let chat = { oid: 20n, chatInstanceProviderOid: 80n } as any;
let recipient = {
  userId: 'U1',
  userName: 'ada',
  fullName: 'Ada Lovelace',
  type: 'user',
  role: 'member',
  isMe: false,
  raw: {}
};

describe('chatChannelServiceInternal.upsertChatChannels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.chatChannel.findMany.mockResolvedValue([]);
    tx.chatWorkspace.findMany.mockResolvedValue([]);
    upsertChatAuthors.mockResolvedValue([]);
  });

  it('defaults channel access to true when the adapter omits it', async () => {
    tx.chatChannel.create.mockImplementation(async ({ data }) => data);

    let [channel] = await chatChannelServiceInternal.upsertChatChannels({
      chat,
      channels: [{ id: 'C1', type: 'public', raw: {} } as any]
    });

    expect(tx.chatChannel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ channelId: 'C1', hasAccess: true })
    });
    expect(channel?.hasAccess).toBe(true);
  });

  it('upserts and links a DM recipient while persisting explicit access', async () => {
    upsertChatAuthors.mockResolvedValue([{ ...recipient, id: 'cau_1', oid: 900n }]);
    tx.chatChannel.create.mockImplementation(async ({ data }) => data);

    let [channel] = await chatChannelServiceInternal.upsertChatChannels({
      chat,
      channels: [
        {
          id: 'D1',
          type: 'dm',
          name: 'Ada Lovelace',
          hasAccess: false,
          recipient,
          raw: {}
        } as any
      ]
    });

    expect(upsertChatAuthors).toHaveBeenCalledWith({ chat, authors: [recipient] });
    expect(tx.chatChannel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channelId: 'D1',
        hasAccess: false,
        recipientOid: 900n
      })
    });
    expect(channel?.recipient).toMatchObject({ id: 'cau_1', userId: 'U1' });
  });

  it('updates persisted access and recipient metadata when the sync payload changes', async () => {
    upsertChatAuthors.mockResolvedValue([{ ...recipient, id: 'cau_1', oid: 900n }]);
    tx.chatChannel.findMany.mockResolvedValue([
      {
        oid: 700n,
        id: 'cch_1',
        channelId: 'D1',
        syncHash: 'old',
        recipient: null
      }
    ]);
    tx.chatChannel.update.mockImplementation(async ({ data }) => ({
      oid: 700n,
      id: 'cch_1',
      channelId: 'D1',
      ...data,
      recipient: { ...recipient, id: 'cau_1', oid: 900n }
    }));

    await chatChannelServiceInternal.upsertChatChannels({
      chat,
      channels: [
        {
          id: 'D1',
          type: 'dm',
          hasAccess: false,
          recipient,
          raw: {}
        } as any
      ]
    });

    expect(tx.chatChannel.update).toHaveBeenCalledWith({
      where: { oid: 700n },
      data: expect.objectContaining({ hasAccess: false, recipientOid: 900n }),
      include: { recipient: true }
    });
  });
});
