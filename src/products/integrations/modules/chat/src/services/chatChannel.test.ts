import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, getChatAdapterClientInternal, upsertChatChannels, searchRecords } = vi.hoisted(
  () => ({
    db: {
      chatChannel: { findFirst: vi.fn(), findMany: vi.fn() },
      chatWorkspace: { findFirst: vi.fn() }
    },
    getChatAdapterClientInternal: vi.fn(),
    upsertChatChannels: vi.fn(),
    searchRecords: vi.fn()
  })
);

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({ db }));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  resolveMetorialFacing: vi.fn()
}));

vi.mock('@metorial-subspace/module-search', () => ({
  voyager: { record: { search: searchRecords } },
  voyagerIndex: { chatChannel: { id: 'channel-index' } },
  voyagerSource: Promise.resolve({ id: 'source' })
}));

vi.mock('../internal/chatAdapter', () => ({
  chatAdapterService: { getChatAdapterClientInternal }
}));

vi.mock('../internal/chatChannel', () => ({
  chatChannelServiceInternal: { upsertChatChannels }
}));

import { chatChannelService } from './chatChannel';

let tenant = { oid: 1n, id: 'tenant_1' } as any;
let environment = { oid: 2n } as any;
let chat = {
  oid: 3n,
  chatInstanceProviderOid: 4n,
  chatInstanceProvider: { oid: 4n, status: 'active' }
} as any;

describe('chatChannelService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults database-backed listings to accessible channels', async () => {
    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => false,
      call: vi.fn()
    });
    db.chatChannel.findMany.mockResolvedValue([]);

    let paginator = await chatChannelService.listChatChannelsInternal({
      tenant,
      environment,
      chat
    });
    await paginator.run({});

    expect(db.chatChannel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ hasAccess: true })
      })
    );
  });

  it('filters database-backed listings to inaccessible channels when requested', async () => {
    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => false,
      call: vi.fn()
    });
    db.chatChannel.findMany.mockResolvedValue([]);

    let paginator = await chatChannelService.listChatChannelsInternal({
      tenant,
      environment,
      chat,
      hasAccess: false
    });
    await paginator.run({});

    expect(db.chatChannel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ hasAccess: false })
      })
    );
  });

  it('uses Voyager ids for database-backed channel search', async () => {
    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => false,
      call: vi.fn()
    });
    searchRecords.mockResolvedValue([{ documentId: 'cch_1' }]);
    db.chatChannel.findMany.mockResolvedValue([]);

    let paginator = await chatChannelService.listChatChannelsInternal({
      tenant,
      environment,
      chat,
      search: '  support  '
    });
    await paginator.run({});

    expect(searchRecords).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: tenant.id, query: 'support' })
    );
    expect(db.chatChannel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['cch_1'] } })
      })
    );
  });

  it('persists provider results before returning only the requested access state', async () => {
    let adapterChannels = [
      { id: 'C1', type: 'public', hasAccess: true },
      { id: 'C2', type: 'public', hasAccess: false }
    ];
    let persistedChannels = adapterChannels.map(channel => ({
      ...channel,
      channelId: channel.id
    }));
    let call = vi.fn().mockResolvedValue({
      result: {
        type: 'success',
        output: { channels: adapterChannels }
      }
    });
    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => true,
      call
    });
    upsertChatChannels.mockResolvedValue(persistedChannels);

    let paginator = await chatChannelService.listChatChannelsInternal({
      tenant,
      environment,
      chat,
      hasAccess: false
    });
    let result = await paginator.run({});

    expect(upsertChatChannels).toHaveBeenCalledWith({
      chat,
      channels: adapterChannels
    });
    expect(result.items).toEqual([persistedChannels[1]]);
  });
});
