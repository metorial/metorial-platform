import { getId } from '@metorial-subspace/db';
import { chatWorkspaceInternalService } from '@metorial-subspace/module-chat/src/internal';
import { chatChannelServiceInternal } from '@metorial-subspace/module-chat/src/internal/chatChannel';
import { chatMessageServiceInternal } from '@metorial-subspace/module-chat/src/internal/chatMessage';
import { chatThreadServiceInternal } from '@metorial-subspace/module-chat/src/internal/chatThread';
import {
  API_VERSIONS,
  authClients,
  createRemoteProvider,
  expectOk,
  metorialEndpoints,
  rest,
  uniqueId,
  type BootstrappedOrganization,
  type McpTestServer,
  type RemoteProvider,
  type RestClient
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';

type Workspace = Parameters<
  typeof chatWorkspaceInternalService.upsertChatWorkspaces
>[0]['workspaces'][number];
type Channel = Parameters<
  typeof chatChannelServiceInternal.upsertChatChannels
>[0]['channels'][number];
type Thread = Parameters<
  typeof chatThreadServiceInternal.upsertChatThreads
>[0]['threads'][number];
type Message = Parameters<
  typeof chatMessageServiceInternal.upsertChatMessages
>[0]['messages'][number];

let dashboardCredentials = ['session', 'member', 'otherSession'];
let managementCredentials = ['management', 'otherManagement'];

export let providerSetupTimeout = 180_000;
export let workerTimeout = { timeoutMs: 60_000, intervalMs: 500 };

export let readStatuses = {
  none: 401,
  session: 200,
  member: 200,
  management: 200,
  instance: 200,
  publishable: 403,
  otherSession: 404,
  otherManagement: 404
};

export let ownResourceStatuses = { ...readStatuses, otherInstance: 404 };

export let writeDenials = {
  none: 401,
  publishable: 403,
  otherSession: 404,
  otherManagement: 404,
  otherInstance: 404
};

/** Session credentials use the dashboard alias, management keys the `/instances/:id` alias. */
export let routeFor = (org: BootstrappedOrganization, credential: string, path: string) => {
  if (dashboardCredentials.includes(credential)) {
    return `/dashboard/instances/${org.ids.instanceId}${path}`;
  }
  if (managementCredentials.includes(credential)) {
    return `/instances/${org.ids.instanceId}${path}`;
  }
  return path;
};

export let createPublishableClient = async (org: BootstrappedOrganization) => {
  let key = expectOk(
    await org.clients.rest.post(
      `/dashboard/organizations/${org.ids.organizationId}/api-keys`,
      {
        type: 'instance_access_token_publishable',
        instance_id: org.ids.instanceId,
        name: uniqueId('e2e-publishable')
      }
    )
  );

  return rest(metorialEndpoints().api, {
    apiKey: key.secret,
    version: API_VERSIONS.magnetar
  });
};

export let tenantClients = <Extra extends Record<string, RestClient>>(
  org: BootstrappedOrganization,
  otherOrg: BootstrappedOrganization,
  extra: Extra
) =>
  authClients(org, {
    otherSession: rest(metorialEndpoints().api, { session: otherOrg.session }),
    otherManagement: otherOrg.clients.management,
    otherInstance: otherOrg.clients.instance,
    ...extra
  });

let ensureChatAdapterGlobal = async () =>
  subspaceDb.providerAdapterGlobal.upsert({
    where: { identifier: 'chat' },
    create: { ...getId('providerAdapterGlobal'), identifier: 'chat', name: 'Chat' },
    update: {}
  });

// Mirrors what the slates sync records for a chat adapter slate, minus every capability: the
// remote MCP test provider can't serve chat tools, so reads fall back to the local store and
// writes are rejected.
let markProviderAsChatCapable = async (providerId: string) => {
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
};

export let createChatProviders = (org: BootstrappedOrganization, server: McpTestServer) => {
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

export let createConnection = async (
  client: RestClient,
  providerId: string,
  body: Record<string, unknown> = {}
) =>
  expectOk(
    await client.post('/chat/connections', {
      name: uniqueId('Chat connection'),
      provider: { provider_id: providerId },
      ...body
    })
  );

export let createChatSetup = async (client: RestClient, providerId: string) => {
  let connection = await createConnection(client, providerId);
  let instance = expectOk(
    await client.post('/chat/instances', {
      chat_connection_id: connection.id,
      name: uniqueId('Chat instance')
    })
  );
  let instanceProvider = expectOk(
    await client.patch(`/chat/instances/${instance.id}/provider`, { provider_id: providerId })
  );

  return { connection, instance, instanceProvider };
};

export type ChatSetup = Awaited<ReturnType<typeof createChatSetup>>;

export let slateChannel = (
  id: string,
  workspaceId: string,
  overrides: Partial<Channel> = {}
) =>
  ({
    id,
    workspaceId,
    type: 'public',
    name: `channel-${id}`,
    hasAccess: true,
    ...overrides
  }) as Channel;

export let slateMessage = (
  id: string,
  channelId: string,
  d: { text?: string; threadId?: string } = {}
) =>
  ({
    id,
    channelId,
    threadId: d.threadId,
    author: {
      userId: 'u-e2e',
      userName: 'u-e2e',
      fullName: 'E2E User',
      type: 'user',
      isMe: false
    },
    body: { parts: [{ type: 'text', content: d.text ?? `Message ${id}` }] },
    metadata: { sentAt: new Date().toISOString(), edited: false }
  }) as Message;

/** Seeds a provider workspace, which the chat module turns into a chat. */
export let seedChat = async (setup: ChatSetup, workspace: Partial<Workspace> = {}) => {
  let chatInstanceProvider = await subspaceDb.chatInstanceProvider.findUniqueOrThrow({
    where: { id: setup.instanceProvider.id }
  });
  let workspaceId = uniqueId('ws');

  let [upserted] = await chatWorkspaceInternalService.upsertChatWorkspaces({
    chatInstanceProvider,
    workspaces: [{ id: workspaceId, name: `Workspace ${workspaceId}`, ...workspace }]
  });
  let chat = await subspaceDb.chat.findUniqueOrThrow({
    where: { oid: upserted!.chat.oid },
    include: { chatInstanceProvider: true }
  });

  return { chat, workspaceId, workspace: upserted!.workspace };
};

export type SeededChat = Awaited<ReturnType<typeof seedChat>>;

export let seedChannel = async (seeded: SeededChat, overrides: Partial<Channel> = {}) => {
  let channelId = uniqueId('ch');
  let [channel] = await chatChannelServiceInternal.upsertChatChannels({
    chat: seeded.chat,
    channels: [slateChannel(channelId, seeded.workspaceId, overrides)]
  });

  return { channelId, channel: channel! };
};

export let seedThread = async (
  seeded: SeededChat,
  channel: Awaited<ReturnType<typeof seedChannel>>
) => {
  let threadId = uniqueId('th');
  let [thread] = await chatThreadServiceInternal.upsertChatThreads({
    chat: seeded.chat,
    channel: channel.channel,
    threads: [{ id: threadId, channelId: channel.channelId, type: 'conversation' } as Thread]
  });

  return { threadId, thread: thread! };
};

export let seedMessages = async (
  seeded: SeededChat,
  channel: Awaited<ReturnType<typeof seedChannel>>,
  messages: Message[]
) => {
  let provider = seeded.chat.chatInstanceProvider;

  return await chatMessageServiceInternal.upsertChatMessages({
    tenant: await subspaceDb.tenant.findUniqueOrThrow({ where: { oid: provider.tenantOid } }),
    environment: await subspaceDb.environment.findUniqueOrThrow({
      where: { oid: provider.environmentOid }
    }),
    chat: seeded.chat,
    channel: channel.channel,
    messages
  });
};
