import type {
  AttachmentRef,
  Author,
  Channel,
  Message,
  ReactionCount,
  Thread,
  Workspace
} from '@metorial-subspace/adapter-chat';
import { type ChatInstanceProvider, getId } from '@metorial-subspace/db';
import {
  createRemoteProvider,
  type McpTestServer,
  type RemoteProvider,
  uniqueId,
  type useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { expect } from 'vitest';
import {
  chatConnectionService,
  chatInstanceProviderService,
  chatInstanceService
} from '../src';

type Organization = ReturnType<typeof useOrganization>;

export type Fixture = Awaited<ReturnType<typeof loadOrganizationFixture>>;

export type Paginator<T> = {
  run: (input: { limit?: number; after?: string; order?: 'asc' | 'desc' }) => Promise<{
    items: T[];
    pagination: { hasNextPage: boolean };
  }>;
};

export let workerTimeout = { timeoutMs: 60_000, intervalMs: 500 };

export let providerTestTimeout = 180_000;

export let pageThrough = async <T extends { id: string }>(
  paginator: Paginator<T>,
  order?: 'asc' | 'desc'
) => {
  let items: T[] = [];
  let after: string | undefined;

  for (let page = 0; page < 30; page++) {
    let list = await paginator.run({ limit: 1, after, order });
    items.push(...list.items);

    if (!list.pagination.hasNextPage || !list.items.length) return items;
    after = list.items.at(-1)!.id;
  }

  throw new Error('The paginator still had more pages after 30 pages');
};

// Ids sort by the database collation, which differs from JS string order.
export let expectConsistentPaging = async <T extends { id: string }>(
  paginator: Paginator<T>,
  ids: string[]
) => {
  let ascending = (await pageThrough(paginator, 'asc')).map(item => item.id);
  let descending = (await pageThrough(paginator, 'desc')).map(item => item.id);

  expect([...ascending].sort()).toEqual([...ids].sort());
  expect(new Set(ascending).size).toBe(ids.length);
  expect(descending).toEqual([...ascending].reverse());
};

export let ensureChatAdapterGlobal = async () =>
  subspaceDb.providerAdapterGlobal.upsert({
    where: { identifier: 'chat' },
    create: { ...getId('providerAdapterGlobal'), identifier: 'chat', name: 'Chat' },
    update: {}
  });

// What the slates sync records for a slate implementing the chat adapter, minus every capability:
// remote MCP providers can't serve `metorial_chat$...` tool keys, so the module must fall back to
// its local store for reads and reject writes.
export let markProviderAsChatCapable = async (providerId: string) => {
  let global = await ensureChatAdapterGlobal();
  let provider = await subspaceDb.provider.findUniqueOrThrow({ where: { id: providerId } });

  let adapter = await subspaceDb.providerAdapter.upsert({
    where: { providerOid_globalOid: { providerOid: provider.oid, globalOid: global.oid } },
    create: {
      ...getId('providerAdapter'),
      identifier: 'chat',
      globalOid: global.oid,
      providerOid: provider.oid
    },
    update: {}
  });

  let versions = await subspaceDb.providerVersion.findMany({
    where: { providerOid: provider.oid },
    select: { oid: true }
  });
  for (let version of versions) {
    await subspaceDb.providerVersionAdapter.upsert({
      where: {
        providerVersionOid_adapterOid: {
          providerVersionOid: version.oid,
          adapterOid: adapter.oid
        }
      },
      create: {
        ...getId('providerVersionAdapter'),
        capabilities: [],
        providerVersionOid: version.oid,
        adapterOid: adapter.oid
      },
      update: {}
    });
  }

  return { provider, adapter };
};

export let useChatProviders = (org: Organization, server: McpTestServer) => {
  let capable: Promise<RemoteProvider> | undefined;
  let plain: Promise<RemoteProvider> | undefined;

  return {
    capable: () =>
      (capable ??= (async () => {
        let remote = await createRemoteProvider(org.clients.instance, {
          url: server.url,
          name: uniqueId('chat-provider')
        });
        await markProviderAsChatCapable(remote.providerId);
        return remote;
      })()),

    plain: () =>
      (plain ??= createRemoteProvider(org.clients.instance, {
        url: server.url,
        name: uniqueId('plain-provider')
      }))
  };
};

export let createStandaloneConnection = async (
  fixture: Fixture,
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
  } = {}
) => {
  await ensureChatAdapterGlobal();

  return chatConnectionService.createChatConnection({
    instance: fixture.instance,
    mode: 'standalone',
    input: { ...input, name: input.name ?? uniqueId('Chat connection') }
  });
};

export let createChatSetup = async (fixture: Fixture, providerId: string) => {
  let chatConnection = await chatConnectionService.createChatConnectionWithProvider({
    instance: fixture.instance,
    mode: 'standalone',
    input: { name: uniqueId('Chat connection') },
    provider: { providerId }
  });

  let chatInstance = await chatInstanceService.createChatInstance({
    instance: fixture.instance,
    chatConnection,
    createStandaloneInstance: { name: uniqueId('Chat instance') }
  });

  let [chatInstanceProvider] = await chatInstanceProviderService.setChatInstanceProvider({
    instance: fixture.instance,
    chatInstance,
    input: { providerId }
  });
  if (!chatInstanceProvider) throw new Error('No chat instance provider was created');

  return { chatConnection, chatInstance, chatInstanceProvider };
};

export let slateAuthor = (userId: string, overrides: Partial<Author> = {}): Author => ({
  userId,
  userName: userId,
  fullName: `User ${userId}`,
  type: 'user',
  isMe: false,
  ...overrides
});

export let slateWorkspace = (id: string, overrides: Partial<Workspace> = {}): Workspace => ({
  id,
  name: `Workspace ${id}`,
  ...overrides
});

export let slateChannel = (
  id: string,
  workspaceId: string,
  overrides: Partial<Channel> = {}
): Channel => ({
  id,
  workspaceId,
  type: 'public',
  name: `channel-${id}`,
  hasAccess: true,
  ...overrides
});

export let slateThread = (
  id: string,
  channelId: string,
  overrides: Partial<Thread> = {}
): Thread => ({
  id,
  channelId,
  type: 'conversation',
  ...overrides
});

export let slateMessage = (
  id: string,
  channelId: string,
  d: {
    text?: string;
    author?: Author;
    threadId?: string;
    sentAt?: Date;
    reactions?: ReactionCount[];
    attachments?: AttachmentRef[];
  } = {}
): Message => ({
  id,
  channelId,
  threadId: d.threadId,
  author: d.author ?? slateAuthor('u-default'),
  body: {
    parts: [{ type: 'text', content: d.text ?? `Message ${id}` }],
    attachments: d.attachments
  },
  reactions: d.reactions,
  metadata: { sentAt: (d.sentAt ?? new Date()).toISOString(), edited: false }
});

export let loadChatScope = async (chatInstanceProvider: ChatInstanceProvider) => ({
  tenant: await subspaceDb.tenant.findUniqueOrThrow({
    where: { oid: chatInstanceProvider.tenantOid }
  }),
  environment: await subspaceDb.environment.findUniqueOrThrow({
    where: { oid: chatInstanceProvider.environmentOid }
  })
});

export let loadChat = async (chatOid: bigint) =>
  subspaceDb.chat.findUniqueOrThrow({
    where: { oid: chatOid },
    include: { chatInstanceProvider: true }
  });
