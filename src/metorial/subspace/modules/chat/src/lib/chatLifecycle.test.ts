import { beforeEach, describe, expect, it, vi } from 'vitest';

let { tx } = vi.hoisted(() => {
  let createModel = () => ({
    findMany: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn()
  });

  return {
    tx: {
      chat: createModel(),
      chatMessage: createModel(),
      chatThread: createModel(),
      chatChannel: createModel(),
      chatAuthor: createModel(),
      chatWorkspace: createModel()
    }
  };
});

vi.mock('@metorial-subspace/db', () => ({
  withTransaction: async (cb: (db: any) => Promise<any>) => await cb(tx)
}));

import { archiveChatsWhere, deleteChatsWhere, restoreChatsWhere } from './chatLifecycle';

describe('chatLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.chat.updateMany.mockResolvedValue({ count: 1 });
    tx.chat.findMany.mockResolvedValue([]);
    tx.chatMessage.deleteMany.mockResolvedValue({ count: 0 });
    tx.chatThread.deleteMany.mockResolvedValue({ count: 0 });
    tx.chatChannel.deleteMany.mockResolvedValue({ count: 0 });
    tx.chatAuthor.deleteMany.mockResolvedValue({ count: 0 });
    tx.chatWorkspace.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('archives chats that are not already deleted', async () => {
    await archiveChatsWhere({ chatIntegrationInstanceOid: 20n }, new Date('2026-01-01'));

    expect(tx.chat.updateMany).toHaveBeenCalledWith({
      where: {
        AND: [{ chatIntegrationInstanceOid: 20n }, { status: { not: 'deleted' } }]
      },
      data: {
        status: 'archived',
        archivedAt: new Date('2026-01-01'),
        isParentDeleted: true
      }
    });
  });

  it('restores archived chats', async () => {
    await restoreChatsWhere({ chatIntegrationInstanceProviderOid: 80n });

    expect(tx.chat.updateMany).toHaveBeenCalledWith({
      where: {
        AND: [{ chatIntegrationInstanceProviderOid: 80n }, { status: 'archived' }]
      },
      data: {
        status: 'active',
        archivedAt: null,
        isParentDeleted: false
      }
    });
  });

  it('deletes nested workspace, thread, channel, and message rows then marks chats deleted', async () => {
    tx.chat.findMany
      .mockResolvedValueOnce([{ oid: 500n }, { oid: 501n }])
      .mockResolvedValueOnce([]);

    await deleteChatsWhere({ chatIntegrationOid: 10n });

    expect(tx.chatMessage.deleteMany).toHaveBeenCalledWith({
      where: { author: { chatOid: { in: [500n, 501n] } } }
    });
    expect(tx.chatThread.deleteMany).toHaveBeenCalledWith({
      where: { chatOid: { in: [500n, 501n] } }
    });
    expect(tx.chatChannel.deleteMany).toHaveBeenCalledWith({
      where: { chatOid: { in: [500n, 501n] } }
    });
    expect(tx.chatAuthor.deleteMany).toHaveBeenCalledWith({
      where: { chatOid: { in: [500n, 501n] } }
    });
    expect(tx.chatWorkspace.deleteMany).toHaveBeenCalledWith({
      where: { chatOid: { in: [500n, 501n] } }
    });
    expect(tx.chat.updateMany).toHaveBeenCalledWith({
      where: { oid: { in: [500n, 501n] } },
      data: {
        status: 'deleted',
        name: '[deleted]',
        isParentDeleted: true
      }
    });
  });
});
