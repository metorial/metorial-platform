import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  db,
  tx,
  dbNull,
  enqueueChatMessageAttachmentCleanup,
  enqueueChatMessageAttachmentSync,
  createChatMessageAttachment,
  upsertChatAuthors,
  attachInboundMessageToGroup
} = vi.hoisted(() => {
  let createModel = () => ({
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn()
  });

  return {
    db: {
      chatMessage: createModel(),
      chatMessageAttachment: createModel(),
      chatThread: createModel()
    },
    tx: { chatMessage: createModel() },
    dbNull: { __prismaDbNull: true },
    enqueueChatMessageAttachmentCleanup: vi.fn(),
    enqueueChatMessageAttachmentSync: vi.fn(),
    createChatMessageAttachment: vi.fn(),
    upsertChatAuthors: vi.fn(),
    attachInboundMessageToGroup: vi.fn()
  };
});

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({ build: () => factory() }))
  }
}));

vi.mock('@lowerdeck/canonicalize', () => ({
  canonicalize: (value: unknown) =>
    JSON.stringify(value, (_key, entry) =>
      typeof entry === 'bigint' ? entry.toString() : entry
    )
}));

vi.mock('@lowerdeck/hash', () => ({
  Hash: { sha256: vi.fn(async (data: string) => `hash:${data}`) }
}));

vi.mock('@metorial-subspace/db', () => ({
  db,
  getId: (model: string) => ({ id: `${model}_new`, oid: BigInt(700) }),
  Prisma: { DbNull: dbNull },
  withTransaction: async (cb: (client: any) => Promise<any>) => await cb(tx)
}));

vi.mock('../queues/attachment/cleanup', () => ({ enqueueChatMessageAttachmentCleanup }));

vi.mock('../queues/attachment/sync', () => ({ enqueueChatMessageAttachmentSync }));

vi.mock('./chatAuthor', () => ({
  chatAuthorServiceInternal: { upsertChatAuthors }
}));

vi.mock('./chatChannel', () => ({
  chatChannelServiceInternal: { upsertChatChannels: vi.fn() }
}));

vi.mock('./chatMessageAttachment', () => ({
  chatMessageAttachmentInternalService: { createChatMessageAttachment }
}));

vi.mock('./chatMessageGroup', () => ({
  chatMessageGroupServiceInternal: { attachInboundMessageToGroup }
}));

vi.mock('./chatThread', () => ({
  chatThreadServiceInternal: { upsertChatThreads: vi.fn() }
}));

import { chatMessageServiceInternal } from './chatMessage';

let tenant = { oid: BigInt(1), id: 'ten_1' } as any;
let environment = { oid: BigInt(2), id: 'env_1' } as any;
let chat = { oid: BigInt(5), id: 'cht_1' } as any;
let channel = {
  oid: BigInt(50),
  id: 'chc_1',
  channelId: 'C1',
  providerType: 'channel'
} as any;

let inboundMessage = (overrides: Record<string, any> = {}) => ({
  id: 'M1',
  channelId: 'C1',
  providerType: 'message',
  author: { userId: 'U1' },
  body: { parts: [{ type: 'text', text: 'hi' }] },
  reactions: null,
  unfurls: null,
  metadata: { sentAt: '2026-02-01T10:00:00.000Z', edited: false, editedAt: null },
  ...overrides
});

describe('chatMessageServiceInternal.softDeleteChatMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.chatMessageAttachment.findMany.mockResolvedValue([]);
    db.chatMessageAttachment.deleteMany.mockResolvedValue({ count: 0 });
    db.chatMessage.updateMany.mockResolvedValue({ count: 1 });
  });

  it('clears the content of the message but keeps the row as a tombstone', async () => {
    let deletedAt = new Date('2026-02-01T12:00:00Z');

    await chatMessageServiceInternal.softDeleteChatMessages({
      messageOids: [BigInt(500), BigInt(501)],
      deletedAt
    });

    expect(db.chatMessage.updateMany).toHaveBeenCalledWith({
      where: { oid: { in: [BigInt(500), BigInt(501)] }, deletedAt: null },
      data: {
        deletedAt,
        body: dbNull,
        reactions: dbNull,
        unfurls: dbNull,
        syncHash: null
      }
    });
  });

  it('deletes the attachment rows and enqueues their files for cleanup', async () => {
    let attachments = [
      { fileId: 'fil_1', uploadedFileId: 'ufi_1', uploadedFileReferenceId: 'ufr_1' }
    ];
    db.chatMessageAttachment.findMany.mockResolvedValue(attachments);

    await chatMessageServiceInternal.softDeleteChatMessages({ messageOids: [BigInt(500)] });

    expect(db.chatMessageAttachment.deleteMany).toHaveBeenCalledWith({
      where: { messageOid: { in: [BigInt(500)] } }
    });
    expect(enqueueChatMessageAttachmentCleanup).toHaveBeenCalledWith(attachments);
  });

  it('does nothing when no messages were deleted', async () => {
    await chatMessageServiceInternal.softDeleteChatMessages({ messageOids: [] });

    expect(db.chatMessageAttachment.findMany).not.toHaveBeenCalled();
    expect(db.chatMessage.updateMany).not.toHaveBeenCalled();
    expect(enqueueChatMessageAttachmentCleanup).not.toHaveBeenCalled();
  });
});

describe('chatMessageServiceInternal.tombstoneChatMessage', () => {
  let deletedAt = new Date('2026-02-01T12:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    db.chatMessageAttachment.findMany.mockResolvedValue([]);
    db.chatMessageAttachment.deleteMany.mockResolvedValue({ count: 0 });
    db.chatMessage.updateMany.mockResolvedValue({ count: 1 });
  });

  it('creates the row already deleted when the delete arrived before the message', async () => {
    db.chatMessage.findUnique.mockResolvedValue(null);
    db.chatMessage.create.mockImplementation(async ({ data }: any) => ({
      oid: BigInt(700),
      ...data
    }));

    let message = await chatMessageServiceInternal.tombstoneChatMessage({
      channel,
      messageId: 'M1',
      threadOid: null,
      deletedAt
    });

    expect(db.chatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        messageId: 'M1',
        providerType: 'channel',
        channelOid: BigInt(50),
        threadOid: null,
        sentAt: deletedAt,
        deletedAt
      })
    });
    expect(db.chatMessage.create.mock.calls[0]![0].data.body).toBeUndefined();
    expect(message.deletedAt).toBe(deletedAt);
  });

  it('soft deletes a message that was already stored', async () => {
    db.chatMessage.findUnique.mockResolvedValue({ oid: BigInt(500), deletedAt: null });
    db.chatMessage.findUniqueOrThrow.mockResolvedValue({ oid: BigInt(500), deletedAt });

    let message = await chatMessageServiceInternal.tombstoneChatMessage({
      channel,
      messageId: 'M1',
      threadOid: BigInt(60),
      deletedAt
    });

    expect(db.chatMessage.create).not.toHaveBeenCalled();
    expect(db.chatMessage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: { in: [BigInt(500)] }, deletedAt: null },
        data: expect.objectContaining({ deletedAt, body: dbNull, syncHash: null })
      })
    );
    expect(message.deletedAt).toBe(deletedAt);
  });

  it('falls back to the racing writer row when the tombstone create collides', async () => {
    db.chatMessage.findUnique.mockResolvedValue(null);
    db.chatMessage.create.mockRejectedValue({ code: 'P2002' });
    db.chatMessage.findUniqueOrThrow
      .mockResolvedValueOnce({ oid: BigInt(500), deletedAt: null })
      .mockResolvedValueOnce({ oid: BigInt(500), deletedAt });

    let message = await chatMessageServiceInternal.tombstoneChatMessage({
      channel,
      messageId: 'M1',
      threadOid: null,
      deletedAt
    });

    expect(db.chatMessage.updateMany).toHaveBeenCalled();
    expect(message.deletedAt).toBe(deletedAt);
  });
});

describe('chatMessageServiceInternal.upsertChatMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertChatAuthors.mockResolvedValue([{ userId: 'U1', oid: BigInt(60) }]);
    db.chatThread.findMany.mockResolvedValue([]);
    tx.chatMessage.findMany.mockResolvedValue([]);
    tx.chatMessage.create.mockImplementation(async ({ data }: any) => ({
      oid: BigInt(700),
      ...data
    }));
    tx.chatMessage.update.mockImplementation(async ({ data }: any) => ({
      oid: BigInt(500),
      ...data
    }));
    createChatMessageAttachment.mockResolvedValue({ id: 'cma_1' });
  });

  it('creates a message the channel has not seen before', async () => {
    let [message] = await chatMessageServiceInternal.upsertChatMessages({
      tenant,
      environment,
      chat,
      channel,
      messages: [inboundMessage()] as any
    });

    expect(tx.chatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        messageId: 'M1',
        channelOid: BigInt(50),
        authorOid: BigInt(60),
        body: { parts: [{ type: 'text', text: 'hi' }] }
      })
    });
    expect(message!.messageId).toBe('M1');
  });

  it('never revives a deleted message when the same message is received again', async () => {
    let deletedAt = new Date('2026-02-01T12:00:00Z');
    tx.chatMessage.findMany.mockResolvedValue([
      {
        oid: BigInt(500),
        messageId: 'M1',
        deletedAt,
        body: null,
        reactions: null,
        unfurls: null,
        syncHash: null
      }
    ]);

    let [message] = await chatMessageServiceInternal.upsertChatMessages({
      tenant,
      environment,
      chat,
      channel,
      messages: [inboundMessage()] as any
    });

    expect(tx.chatMessage.update).not.toHaveBeenCalled();
    expect(tx.chatMessage.create).not.toHaveBeenCalled();
    expect(message!.deletedAt).toBe(deletedAt);
    expect(message!.body).toBeNull();
  });

  it('never revives a deleted message when an edit arrives for it', async () => {
    let deletedAt = new Date('2026-02-01T12:00:00Z');
    tx.chatMessage.findMany.mockResolvedValue([
      {
        oid: BigInt(500),
        messageId: 'M1',
        deletedAt,
        body: null,
        syncHash: 'stale'
      }
    ]);

    await chatMessageServiceInternal.upsertChatMessages({
      tenant,
      environment,
      chat,
      channel,
      messages: [
        inboundMessage({
          body: { parts: [{ type: 'text', text: 'edited' }] },
          metadata: {
            sentAt: '2026-02-01T10:00:00.000Z',
            edited: true,
            editedAt: '2026-02-01T13:00:00.000Z'
          }
        })
      ] as any
    });

    expect(tx.chatMessage.update).not.toHaveBeenCalled();
  });

  it('updates a live message whose payload changed', async () => {
    tx.chatMessage.findMany.mockResolvedValue([
      { oid: BigInt(500), messageId: 'M1', deletedAt: null, syncHash: 'stale' }
    ]);

    await chatMessageServiceInternal.upsertChatMessages({
      tenant,
      environment,
      chat,
      channel,
      messages: [inboundMessage()] as any
    });

    expect(tx.chatMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { oid: BigInt(500) } })
    );
  });

  it('persists attachment metadata before queueing its content sync', async () => {
    db.chatMessageAttachment.findMany.mockResolvedValue([]);

    await chatMessageServiceInternal.upsertChatMessages({
      tenant,
      environment,
      chat,
      channel,
      messages: [
        inboundMessage({
          body: {
            parts: [],
            attachments: [
              { id: 'att_1', name: 'a.png' },
              { id: 'att_2', name: 'b.png' }
            ]
          }
        })
      ] as any
    });

    expect(createChatMessageAttachment).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        message: expect.objectContaining({ oid: BigInt(700) }),
        attachment: expect.objectContaining({ id: 'att_1' }),
        position: 0
      })
    );
    expect(createChatMessageAttachment).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        attachment: expect.objectContaining({ id: 'att_2' }),
        position: 1
      })
    );
    expect(createChatMessageAttachment.mock.invocationCallOrder[0]).toBeLessThan(
      enqueueChatMessageAttachmentSync.mock.invocationCallOrder[0]!
    );
    expect(enqueueChatMessageAttachmentSync).toHaveBeenCalledWith(
      expect.objectContaining({ chatMessageAttachmentId: 'cma_1' })
    );
  });

  it('does not queue attachment sync for a message that stayed deleted', async () => {
    let deletedAt = new Date('2026-02-01T12:00:00Z');
    tx.chatMessage.findMany.mockResolvedValue([
      { oid: BigInt(500), messageId: 'M1', deletedAt, body: null, syncHash: null }
    ]);
    db.chatMessageAttachment.findMany.mockResolvedValue([]);

    await chatMessageServiceInternal.upsertChatMessages({
      tenant,
      environment,
      chat,
      channel,
      messages: [
        inboundMessage({
          body: { parts: [], attachments: [{ id: 'att_1', name: 'a.png' }] }
        })
      ] as any
    });

    expect(tx.chatMessage.update).not.toHaveBeenCalled();
    expect(enqueueChatMessageAttachmentSync).not.toHaveBeenCalled();
  });
});
