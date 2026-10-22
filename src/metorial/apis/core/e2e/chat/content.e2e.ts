import {
  eventually,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  uniqueId,
  useMcpTestServer,
  useMember,
  useOrganization,
  type RemoteProvider,
  type RestClient
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createChatProviders,
  createChatSetup,
  createPublishableClient,
  ownResourceStatuses,
  providerSetupTimeout,
  readStatuses,
  routeFor,
  seedChannel,
  seedChat,
  seedMessages,
  seedThread,
  slateMessage,
  tenantClients,
  workerTimeout,
  writeDenials,
  type ChatSetup,
  type SeededChat
} from './_shared';

describe('api-core chat content', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);
  let server = useMcpTestServer();
  let providers = createChatProviders(org, server);

  let publishable: RestClient;
  let capable: RemoteProvider;
  let setup: ChatSetup;
  let seeded: SeededChat;
  let channel: Awaited<ReturnType<typeof seedChannel>>;
  let thread: Awaited<ReturnType<typeof seedThread>>;
  let messageIds: string[];

  beforeAll(async () => {
    publishable = await createPublishableClient(org);
    capable = await providers.capable();
    setup = await createChatSetup(org.clients.instance, capable.providerId);

    seeded = await seedChat(setup);
    channel = await seedChannel(seeded);
    thread = await seedThread(seeded, channel);
    messageIds = [uniqueId('m'), uniqueId('m'), uniqueId('m')];
    await seedMessages(seeded, channel, [
      slateMessage(messageIds[0]!, channel.channelId, { text: 'first' }),
      slateMessage(messageIds[1]!, channel.channelId, { text: 'second' }),
      slateMessage(messageIds[2]!, channel.channelId, {
        text: 'in thread',
        threadId: thread.threadId
      })
    ]);
  }, providerSetupTimeout);

  let clients = () =>
    tenantClients(org, otherOrg, { member: member.clients.rest, publishable });
  let chatPath = (suffix = '') => `/chats/${seeded.chat.id}${suffix}`;
  let channelQuery = () => ({ channel_id: channel.channelId });
  let textBody = () => ({
    channel_id: channel.channelId,
    parts: [{ type: 'text', content: 'hello' }]
  });

  it('applies the auth matrix to chat reads and writes', async () => {
    await expectAuthMatrix(
      clients(),
      (client, name) => client.get(routeFor(org, name, '/chats')),
      readStatuses
    );

    let reads = [
      chatPath(),
      chatPath('/channels'),
      chatPath(`/channels/${channel.channelId}`),
      `${chatPath('/threads')}?channel_id=${channel.channelId}`,
      `${chatPath('/messages')}?channel_id=${channel.channelId}`,
      `${chatPath(`/messages/${messageIds[0]}`)}?channel_id=${channel.channelId}`,
      `/chat/workspaces?chat_instance_id=${setup.instance.id}`
    ];
    for (let path of reads) {
      await expectAuthMatrix(
        clients(),
        (client, name) => client.get(routeFor(org, name, path)),
        ownResourceStatuses
      );
    }

    await expectAuthMatrix(
      clients(),
      (client, name) => client.post(routeFor(org, name, chatPath('/messages')), textBody()),
      {
        ...writeDenials,
        session: 400,
        member: 400,
        management: 400,
        instance: 400
      }
    );
  });

  it('lists, filters and pages chats created from provider workspaces', async () => {
    let extra = [await seedChat(setup), await seedChat(setup)];
    let ids = [seeded.chat.id, ...extra.map(entry => entry.chat.id)];

    let byInstance = await listAll(org.clients.instance, '/chats', {
      query: { chat_instance_id: setup.instance.id },
      limit: 1
    });
    expect(byInstance.map(chat => chat.id).sort()).toEqual([...ids].sort());
    byInstance.forEach(chat => expectPresented(chat, 'chat'));

    for (let query of [
      { chat_connection_id: setup.connection.id },
      { chat_instance_provider_id: setup.instanceProvider.id }
    ]) {
      let listed = await listAll(org.clients.instance, '/chats', { query });
      expect(listed.map(chat => chat.id).sort()).toEqual([...ids].sort());
    }

    let single = await listAll(org.clients.instance, '/chats', { query: { id: ids[1]! } });
    expect(single.map(chat => chat.id)).toEqual([ids[1]]);

    let fetched = expectOk(await org.clients.instance.get(chatPath()));
    expectPresented(fetched, 'chat');
    expect(fetched).toMatchObject({
      id: seeded.chat.id,
      status: 'active',
      chat_connection_id: setup.connection.id,
      chat_instance_id: setup.instance.id,
      chat_instance_provider_id: setup.instanceProvider.id,
      provider_id: capable.providerId,
      workspace_id: seeded.workspace.id
    });

    expectError(
      await org.clients.instance.get('/chats', { query: { status: 'paused' } }),
      400,
      'invalid_data'
    );
    expectError(await org.clients.instance.get('/chats/cht_missing'), 404, 'not_found');
  });

  it('lists and fetches workspaces of a chat instance', async () => {
    let workspaces = await listAll(org.clients.instance, '/chat/workspaces', {
      query: { chat_instance_id: setup.instance.id }
    });
    let workspace = workspaces.find(entry => entry.id === seeded.workspace.id);
    expect(workspace).toBeDefined();
    expectPresented(workspace, 'chat.workspace');
    expect(workspace).toMatchObject({
      chat_id: seeded.chat.id,
      provider_workspace_id: seeded.workspaceId
    });

    let fetched = expectOk(
      await org.clients.instance.get(`/chat/workspaces/${seeded.workspace.id}`, {
        query: { chat_instance_id: setup.instance.id }
      })
    );
    expect(fetched.id).toBe(seeded.workspace.id);

    expectError(await org.clients.instance.get('/chat/workspaces'), 400, 'invalid_data');
    expectError(
      await org.clients.instance.get(`/chat/workspaces/${seeded.workspace.id}`),
      400,
      'invalid_data'
    );
    expectError(
      await otherOrg.clients.instance.get('/chat/workspaces', {
        query: { chat_instance_id: setup.instance.id }
      }),
      404
    );
  });

  it('lists, filters and fetches channels by provider or local id', async () => {
    let privateChannel = await seedChannel(seeded, { type: 'private' });
    let hidden = await seedChannel(seeded, { hasAccess: false });

    let accessible = await listAll(org.clients.instance, chatPath('/channels'));
    let accessibleIds = accessible.map(entry => entry.id);
    expect(accessibleIds).toEqual(
      expect.arrayContaining([channel.channel.id, privateChannel.channel.id])
    );
    expect(accessibleIds).not.toContain(hidden.channel.id);
    accessible.forEach(entry => expectPresented(entry, 'chat.channel'));

    let privates = await listAll(org.clients.instance, chatPath('/channels'), {
      query: { type: 'private' }
    });
    expect(privates.map(entry => entry.id)).toEqual([privateChannel.channel.id]);

    let inaccessible = await listAll(org.clients.instance, chatPath('/channels'), {
      query: { has_access: false }
    });
    expect(inaccessible.map(entry => entry.id)).toEqual([hidden.channel.id]);

    let byProviderId = expectOk(
      await org.clients.instance.get(chatPath(`/channels/${channel.channelId}`))
    );
    expect(byProviderId).toMatchObject({
      id: channel.channel.id,
      chat_id: seeded.chat.id,
      provider_channel_id: channel.channelId,
      workspace_id: seeded.workspace.id
    });
    let byLocalId = expectOk(
      await org.clients.instance.get(chatPath(`/channels/${channel.channel.id}`))
    );
    expect(byLocalId.id).toBe(channel.channel.id);

    expectError(
      await org.clients.instance.get(chatPath('/channels/ch-missing')),
      404,
      'not_found'
    );
    expectError(
      await org.clients.instance.get(chatPath('/channels'), { query: { type: 'room' } }),
      400,
      'invalid_data'
    );
  });

  it('lists threads and messages of a channel and pages messages', async () => {
    expectError(await org.clients.instance.get(chatPath('/threads')), 400, 'invalid_data');
    expectError(await org.clients.instance.get(chatPath('/messages')), 400, 'invalid_data');

    let threads = await listAll(org.clients.instance, chatPath('/threads'), {
      query: channelQuery()
    });
    expect(threads.map(entry => entry.id)).toEqual([thread.thread.id]);
    expectPresented(threads[0], 'chat.thread');
    expect(threads[0]).toMatchObject({
      channel_id: channel.channel.id,
      provider_thread_id: thread.threadId,
      type: 'conversation'
    });

    let fetchedThread = expectOk(
      await org.clients.instance.get(chatPath(`/threads/${thread.threadId}`), {
        query: channelQuery()
      })
    );
    expect(fetchedThread.id).toBe(thread.thread.id);

    let messages = await listAll(org.clients.instance, chatPath('/messages'), {
      query: channelQuery(),
      limit: 1
    });
    expect(messages.map(entry => entry.provider_message_id).sort()).toEqual(
      [...messageIds].sort()
    );
    messages.forEach(entry => expectPresented(entry, 'chat.message'));

    let inThread = await listAll(org.clients.instance, chatPath('/messages'), {
      query: { ...channelQuery(), thread_id: thread.threadId }
    });
    expect(inThread.map(entry => entry.provider_message_id)).toEqual([messageIds[2]]);
    expect(inThread[0].thread_id).toBe(thread.thread.id);

    let fetched = expectOk(
      await org.clients.instance.get(chatPath(`/messages/${messageIds[0]}`), {
        query: channelQuery()
      })
    );
    expectPresented(fetched, 'chat.message');
    expect(fetched).toMatchObject({
      chat_id: seeded.chat.id,
      channel_id: channel.channel.id,
      provider_message_id: messageIds[0],
      thread_id: null,
      body: { parts: [{ type: 'text', content: 'first' }] }
    });

    expectError(
      await org.clients.instance.get(chatPath('/messages/m-missing'), {
        query: channelQuery()
      }),
      404,
      'not_found'
    );
  });

  it('keeps threads and messages under the channel and chat they belong to', async () => {
    let otherChannel = await seedChannel(seeded);
    let otherChat = await seedChat(setup);
    let otherChatChannel = await seedChannel(otherChat);

    expectError(
      await org.clients.instance.get(chatPath(`/threads/${thread.threadId}`), {
        query: { channel_id: otherChannel.channelId }
      }),
      404
    );
    expectError(
      await org.clients.instance.get(chatPath(`/messages/${messageIds[0]}`), {
        query: { channel_id: otherChannel.channelId }
      }),
      404
    );

    let foreignChatPath = `/chats/${otherChat.chat.id}`;
    expectError(
      await org.clients.instance.get(`${foreignChatPath}/channels/${channel.channelId}`),
      404
    );
    expectError(
      await org.clients.instance.get(`${foreignChatPath}/messages/${messageIds[0]}`, {
        query: channelQuery()
      }),
      404
    );
    expect(
      await listAll(org.clients.instance, `${foreignChatPath}/messages`, {
        query: channelQuery()
      })
    ).toEqual([]);
    expect(
      await listAll(org.clients.instance, `${foreignChatPath}/messages`, {
        query: { channel_id: otherChatChannel.channelId }
      })
    ).toEqual([]);
  });

  it('rejects platform writes the provider does not support', async () => {
    let client = org.clients.instance;
    let messagePath = chatPath(`/messages/${messageIds[0]}`);

    expectError(
      await client.post(chatPath('/messages'), textBody()),
      400,
      'chat_message_send_not_supported'
    );
    expectError(
      await client.post(chatPath('/messages'), {
        ...textBody(),
        ephemeral_target_user_id: 'u-1'
      }),
      400,
      'chat_message_send_ephemeral_not_supported'
    );
    expectError(
      await client.patch(messagePath, textBody()),
      400,
      'chat_message_edit_not_supported'
    );
    expectError(
      await client.delete(messagePath, { query: channelQuery() }),
      400,
      'chat_message_delete_not_supported'
    );
    expectError(
      await client.post(`${messagePath}/read`, channelQuery()),
      400,
      'chat_message_mark_read_not_supported'
    );
    expectError(
      await client.get(chatPath('/messages'), {
        query: { ...channelQuery(), search: 'first' }
      }),
      400,
      'chat_message_search_not_supported'
    );
    expectError(
      await client.post(`${messagePath}/reactions`, { ...channelQuery(), emoji: 'tada' }),
      400,
      'chat_message_reaction_add_not_supported'
    );
    expectError(
      await client.delete(`${messagePath}/reactions`, {
        query: { ...channelQuery(), emoji: 'tada' }
      }),
      400,
      'chat_message_reaction_remove_not_supported'
    );
    expectError(
      await client.post(chatPath('/dms'), {
        type: 'single',
        user: { type: 'generic', user_id: 'u-1' }
      }),
      400,
      'chat_dm_open_single_not_supported'
    );
    expectError(
      await client.post(chatPath('/dms'), {
        type: 'group',
        users: { type: 'generic', user_ids: ['u-1', 'u-2'] }
      }),
      400,
      'chat_dm_open_group_not_supported'
    );
    expectError(
      await client.post(chatPath(`/channels/${channel.channelId}/typing`), {}),
      400,
      'chat_typing_not_supported'
    );
    expectError(
      await client.get(chatPath(`/channels/${channel.channelId}/members`)),
      400,
      'chat_channel_members_read_not_supported'
    );
    expectError(
      await client.get(chatPath(`/channels/${channel.channelId}/members/u-1`)),
      400,
      'chat_user_read_not_supported'
    );

    let stored = await listAll(client, chatPath('/messages'), { query: channelQuery() });
    expect(stored).toHaveLength(messageIds.length);
  });

  it('validates message and DM bodies before touching the provider', async () => {
    let client = org.clients.instance;

    expectError(
      await client.post(chatPath('/messages'), { channel_id: channel.channelId }),
      400,
      'invalid_data'
    );
    expectError(
      await client.post(chatPath('/messages'), {
        channel_id: channel.channelId,
        parts: [{ type: 'blink', content: 'x' }]
      }),
      400,
      'invalid_data'
    );
    expectError(
      await client.post(chatPath('/dms'), { type: 'single', user: { type: 'handle' } }),
      400,
      'invalid_data'
    );
    expectError(
      await client.delete(chatPath(`/messages/${messageIds[0]}/reactions`), {
        query: channelQuery()
      }),
      400,
      'invalid_data'
    );
  });

  it('records chat lifecycle events that can be filtered by chat', async () => {
    let fresh = await seedChat(setup);

    let events = await eventually(async () => {
      let listed = await listAll(org.clients.instance, '/chat/events', {
        query: { chat_id: fresh.chat.id }
      });
      expect(listed.map(event => event.type)).toContain('chat.created');
      return listed;
    }, workerTimeout);

    let created = events.find(event => event.type === 'chat.created');
    expectPresented(created, 'chat.event');
    expect(created).toMatchObject({
      chat_id: fresh.chat.id,
      chat_connection_id: setup.connection.id
    });

    let byType = await listAll(org.clients.instance, '/chat/events', {
      query: { chat_id: fresh.chat.id, type: 'chat.created' }
    });
    expect(byType.map(event => event.id)).toEqual([created.id]);

    let byInstance = await listAll(org.clients.instance, '/chat/events', {
      query: { chat_instance_id: setup.instance.id, type: 'chat.created' }
    });
    expect(byInstance.map(event => event.id)).toContain(created.id);

    expect(
      await listAll(otherOrg.clients.instance, '/chat/events', {
        query: { chat_id: fresh.chat.id }
      })
    ).toEqual([]);
  });

  it(
    'hides chats and their content once their instance is archived',
    async () => {
      let archivedSetup = await createChatSetup(org.clients.instance, capable.providerId);
      let archivedChat = await seedChat(archivedSetup);
      let archivedChannel = await seedChannel(archivedChat);
      await seedThread(archivedChat, archivedChannel);

      expectOk(
        await org.clients.instance.delete(`/chat/instances/${archivedSetup.instance.id}`)
      );

      let path = `/chats/${archivedChat.chat.id}`;
      expectError(await org.clients.instance.get(path), 404, 'not_found');
      expectError(
        await org.clients.instance.get(`${path}/threads`, {
          query: { channel_id: archivedChannel.channelId }
        }),
        404
      );
      expectError(
        await org.clients.instance.post(`${path}/messages`, {
          channel_id: archivedChannel.channelId,
          parts: [{ type: 'text', content: 'too late' }]
        }),
        404
      );

      let archived = await listAll(org.clients.instance, '/chats', {
        query: { chat_instance_id: archivedSetup.instance.id, status: 'archived' }
      });
      expect(archived.map(chat => [chat.id, chat.status])).toEqual([
        [archivedChat.chat.id, 'archived']
      ]);
    },
    providerSetupTimeout
  );

  it('keeps chats and their content private to their organization', async () => {
    let foreign = otherOrg.clients.instance;

    expectError(await foreign.get(chatPath()), 404);
    expectError(await foreign.get(chatPath('/channels')), 404);
    expectError(await foreign.get(chatPath(`/channels/${channel.channelId}`)), 404);
    expectError(await foreign.get(chatPath('/threads'), { query: channelQuery() }), 404);
    expectError(await foreign.get(chatPath('/messages'), { query: channelQuery() }), 404);
    expectError(await foreign.post(chatPath('/messages'), textBody()), 404);
    expectError(
      await foreign.post(chatPath('/dms'), {
        type: 'single',
        user: { type: 'generic', user_id: 'u-1' }
      }),
      404
    );
    expectError(
      await foreign.get(`/chat/workspaces/${seeded.workspace.id}`, {
        query: { chat_instance_id: setup.instance.id }
      }),
      404
    );

    expect(await listAll(foreign, '/chats', { query: { id: seeded.chat.id } })).toEqual([]);
    expect(
      await listAll(foreign, '/chats', { query: { chat_instance_id: setup.instance.id } })
    ).toEqual([]);
  });
});
