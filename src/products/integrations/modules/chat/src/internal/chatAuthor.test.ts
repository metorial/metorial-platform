import { beforeEach, describe, expect, it, vi } from 'vitest';

let { tx } = vi.hoisted(() => {
  let createModel = () => ({
    upsert: vi.fn(),
    updateMany: vi.fn()
  });

  return {
    tx: {
      chatAuthor: createModel(),
      chatInstanceProvider: createModel()
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

vi.mock('@metorial-subspace/db', () => ({
  getId: (kind: string) => ({ id: `${kind}_new`, oid: 500n }),
  withTransaction: async (cb: (db: any) => Promise<any>) => await cb(tx)
}));

import { chatAuthorServiceInternal } from './chatAuthor';

let chat = { oid: 20n, chatInstanceProviderOid: 80n } as any;

let author = (overrides: Partial<Record<string, unknown>> = {}) => ({
  userId: 'U1',
  userName: 'bot',
  fullName: 'Metorial Bot',
  type: 'app',
  role: 'member',
  providerType: 'app',
  isMe: true,
  email: null,
  imageUrl: null,
  raw: {},
  ...overrides
});

describe('chatAuthorServiceInternal.upsertChatAuthors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('links the chat instance provider to a self author record', async () => {
    tx.chatAuthor.upsert.mockResolvedValue({ oid: 900n, id: 'cau_1' });

    await chatAuthorServiceInternal.upsertChatAuthors({
      chat,
      authors: [author({ isMe: true })]
    });

    expect(tx.chatInstanceProvider.updateMany).toHaveBeenCalledWith({
      where: { oid: 80n },
      data: { authorOid: 900n }
    });
  });

  it('links a self author even when authorOid is currently null', async () => {
    tx.chatAuthor.upsert.mockResolvedValue({ oid: 900n, id: 'cau_1' });

    await chatAuthorServiceInternal.upsertChatAuthors({
      chat: { ...chat, authorOid: null } as any,
      authors: [author({ isMe: true })]
    });

    expect(tx.chatInstanceProvider.updateMany).toHaveBeenCalledWith({
      where: { oid: 80n },
      data: { authorOid: 900n }
    });
  });

  it('does not link when the author is not the connection identity', async () => {
    tx.chatAuthor.upsert.mockResolvedValue({ oid: 900n, id: 'cau_1' });

    await chatAuthorServiceInternal.upsertChatAuthors({
      chat,
      authors: [author({ isMe: false })]
    });

    expect(tx.chatInstanceProvider.updateMany).not.toHaveBeenCalled();
  });

  it('links every self author when multiple authors are upserted at once', async () => {
    tx.chatAuthor.upsert
      .mockResolvedValueOnce({ oid: 901n, id: 'cau_1' })
      .mockResolvedValueOnce({ oid: 902n, id: 'cau_2' });

    await chatAuthorServiceInternal.upsertChatAuthors({
      chat,
      authors: [author({ userId: 'U1', isMe: false }), author({ userId: 'U2', isMe: true })]
    });

    expect(tx.chatInstanceProvider.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.chatInstanceProvider.updateMany).toHaveBeenCalledWith({
      where: { oid: 80n },
      data: { authorOid: 902n }
    });
  });
});
