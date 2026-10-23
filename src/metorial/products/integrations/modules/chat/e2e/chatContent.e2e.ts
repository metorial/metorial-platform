import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  chatChannelMemberService,
  chatChannelService,
  chatDmService,
  chatEventService,
  chatInstanceService,
  chatMessageService,
  chatReactionService,
  chatService,
  chatThreadService,
  chatTypingService,
  chatUserService,
  chatWorkspaceService
} from '../src';
import { chatWorkspaceInternalService } from '../src/internal';
import { chatChannelServiceInternal } from '../src/internal/chatChannel';
import { chatMessageServiceInternal } from '../src/internal/chatMessage';
import { chatThreadServiceInternal } from '../src/internal/chatThread';
import { chatDeleteQueue } from '../src/queues/delete/chat';
import { chatInstanceDeleteQueue } from '../src/queues/delete/chatInstance';
import {
  createChatSetup,
  expectConsistentPaging,
  type Fixture,
  loadChat,
  loadChatScope,
  providerTestTimeout,
  slateAuthor,
  slateChannel,
  slateMessage,
  slateThread,
  slateWorkspace,
  useChatProviders,
  workerTimeout
} from './_fixtures';

describe('module-chat chat content', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();
  let providers = useChatProviders(org, server);

  let createSetup = async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let capable = await providers.capable();
    let setup = await createChatSetup(fixture, capable.providerId);
    let scope = await loadChatScope(setup.chatInstanceProvider);
    return { fixture, capable, scope, ...setup };
  };

  type Setup = Awaited<ReturnType<typeof createSetup>>;

  let sharedSetup: Promise<Setup> | undefined;
  let useSetup = () => (sharedSetup ??= createSetup());

  let seedChat = async (setup: Setup, workspaceName?: string) => {
    let workspaceId = uniqueId('ws');
    let [upserted] = await chatWorkspaceInternalService.upsertChatWorkspaces({
      chatInstanceProvider: setup.chatInstanceProvider,
      workspaces: [slateWorkspace(workspaceId, { name: workspaceName })]
    });
    let chat = await loadChat(upserted!.chat.oid);
    return { workspaceId, workspace: upserted!.workspace, chat };
  };

  let seedChannel = async (setup: Setup) => {
    let seeded = await seedChat(setup);
    let channelId = uniqueId('ch');
    let [channel] = await chatChannelServiceInternal.upsertChatChannels({
      chat: seeded.chat,
      channels: [slateChannel(channelId, seeded.workspaceId)]
    });
    return { ...seeded, channelId, channel: channel! };
  };

  let chatEventTypes = async (fixture: Fixture, chatId: string) =>
    (
      await firstPage(
        await chatEventService.listChatEvents({
          instance: fixture.instance,
          chatIds: [chatId]
        })
      )
    )
      .map(item => item.type)
      .sort();

  it(
    'turns a provider workspace into a chat and records chat lifecycle events',
    async () => {
      let setup = await useSetup();
      let { fixture, chatInstanceProvider } = setup;
      let workspaceId = uniqueId('ws');

      let [created] = await chatWorkspaceInternalService.upsertChatWorkspaces({
        chatInstanceProvider,
        workspaces: [slateWorkspace(workspaceId, { name: '  Acme  ', domain: 'acme.test' })]
      });
      let { chat, workspace } = created!;

      expect(chat).toMatchObject({
        status: 'active',
        name: 'Acme',
        chatConnectionOid: chatInstanceProvider.chatConnectionOid,
        chatInstanceOid: chatInstanceProvider.chatInstanceOid,
        chatInstanceProviderOid: chatInstanceProvider.oid
      });
      expect(workspace).toMatchObject({
        workspaceId,
        name: 'Acme',
        domain: 'acme.test',
        chatOid: chat.oid
      });

      let providerRow = await subspaceDb.provider.findUniqueOrThrow({
        where: { id: setup.capable.providerId }
      });
      let adapter = await subspaceDb.providerAdapter.findFirstOrThrow({
        where: { providerOid: providerRow.oid, identifier: 'chat' }
      });
      expect(chat.providerOid).toBe(providerRow.oid);
      expect(chat.adapterOid).toBe(adapter.oid);

      expect(await chatEventTypes(fixture, chat.id)).toEqual([
        'chat.created',
        'chat.workspace.created'
      ]);

      let [again] = await chatWorkspaceInternalService.upsertChatWorkspaces({
        chatInstanceProvider,
        workspaces: [slateWorkspace(workspaceId, { name: '  Acme  ', domain: 'acme.test' })]
      });
      expect(again!.chat.id).toBe(chat.id);
      expect(again!.workspace.id).toBe(workspace.id);
      expect(await chatEventTypes(fixture, chat.id)).toHaveLength(2);

      let [renamed] = await chatWorkspaceInternalService.upsertChatWorkspaces({
        chatInstanceProvider,
        workspaces: [slateWorkspace(workspaceId, { name: 'Acme Corp' })]
      });
      expect(renamed!.chat).toMatchObject({ id: chat.id, name: 'Acme Corp' });
      expect(renamed!.workspace).toMatchObject({ name: 'Acme Corp', domain: null });
      expect(await chatEventTypes(fixture, chat.id)).toEqual([
        'chat.created',
        'chat.updated',
        'chat.workspace.created',
        'chat.workspace.updated'
      ]);

      let createdEvent = (
        await firstPage(
          await chatEventService.listChatEvents({
            instance: fixture.instance,
            chatIds: [chat.id],
            types: ['chat.created']
          })
        )
      )[0]!;
      let { payload } = await chatEventService.getChatEventById({
        instance: fixture.instance,
        chatEventId: createdEvent.id
      });
      expect(payload?.chat).toMatchObject({ id: chat.id });

      let systemEvent = await eventually(
        async () =>
          await db.systemEvent.findUniqueOrThrow({ where: { chatEventId: createdEvent.id } }),
        workerTimeout
      );
      expect(systemEvent).toMatchObject({
        source: 'chat',
        eventType: 'chat.created',
        providerId: setup.capable.providerId
      });
    },
    providerTestTimeout
  );

  it(
    'lists and fetches chats and workspaces from the local store',
    async () => {
      let setup = await useSetup();
      let { fixture, chatInstanceProvider } = setup;
      let first = await seedChat(setup);
      let second = await seedChat(setup);
      let chatIds = [first.chat.id, second.chat.id];

      let paginator = await chatService.listChats({
        instance: fixture.instance,
        ids: chatIds
      });
      await expectConsistentPaging(paginator, chatIds);

      let byProvider = await firstPage(
        await chatService.listChats({
          instance: fixture.instance,
          chatInstanceProviderIds: [chatInstanceProvider.id]
        })
      );
      expect(byProvider.map(item => item.id)).toEqual(expect.arrayContaining(chatIds));

      let fetched = await chatService.getChatById({
        instance: fixture.instance,
        chatId: first.chat.id
      });
      expect(fetched.workspace?.workspaceId).toBe(first.workspaceId);
      expect(fetched.chatInstanceProvider.id).toBe(chatInstanceProvider.id);

      let workspaces = await firstPage(
        await chatWorkspaceService.listChatWorkspaces({
          instance: fixture.instance,
          chatInstanceProvider
        })
      );
      expect(workspaces.map(item => item.workspaceId)).toEqual(
        expect.arrayContaining([first.workspaceId, second.workspaceId])
      );

      let byRemoteId = await chatWorkspaceService.getChatWorkspace({
        instance: fixture.instance,
        chatInstanceProvider,
        workspaceId: first.workspaceId
      });
      expect(byRemoteId.id).toBe(first.workspace.id);
      let byLocalId = await chatWorkspaceService.getChatWorkspace({
        instance: fixture.instance,
        chatInstanceProvider,
        workspaceId: first.workspace.id
      });
      expect(byLocalId.id).toBe(first.workspace.id);

      await expectServiceError(
        chatWorkspaceService.getChatWorkspace({
          instance: fixture.instance,
          chatInstanceProvider,
          workspaceId: uniqueId('missing-ws')
        }),
        'not_found'
      );
      await expectServiceError(
        chatService.getChatById({ instance: fixture.instance, chatId: uniqueId('missing') }),
        'not_found'
      );
    },
    providerTestTimeout
  );

  it(
    'stores channels idempotently and filters them by access, type and workspace',
    async () => {
      let setup = await useSetup();
      let { fixture } = setup;
      let { chat, workspaceId, workspace } = await seedChat(setup);
      let [publicId, privateId, lockedId] = [uniqueId('ch'), uniqueId('ch'), uniqueId('ch')];

      let channels = [
        slateChannel(publicId!, workspaceId),
        slateChannel(privateId!, workspaceId, { type: 'private' }),
        slateChannel(lockedId!, workspaceId, { hasAccess: false })
      ];
      let stored = await chatChannelServiceInternal.upsertChatChannels({ chat, channels });
      expect(stored.map(item => item.channelId)).toEqual([publicId, privateId, lockedId]);
      expect(stored.every(item => item.workspaceOid === workspace.oid)).toBe(true);

      let again = await chatChannelServiceInternal.upsertChatChannels({ chat, channels });
      expect(again.map(item => item.id)).toEqual(stored.map(item => item.id));
      expect(await subspaceDb.chatChannel.count({ where: { chatOid: chat.oid } })).toBe(3);

      let list = async (filter: Record<string, unknown> = {}) =>
        (
          await firstPage(
            await chatChannelService.listChatChannels({
              instance: fixture.instance,
              chat,
              ...filter
            })
          )
        )
          .map(item => item.channelId)
          .sort();

      expect(await list()).toEqual([publicId, privateId].sort());
      expect(await list({ hasAccess: false })).toEqual([lockedId]);
      expect(await list({ type: 'private' })).toEqual([privateId]);
      expect(await list({ workspaceId })).toEqual([publicId, privateId].sort());
      expect(await list({ workspaceId: workspace.id })).toEqual([publicId, privateId].sort());
      expect(await list({ workspaceId: uniqueId('missing-ws') })).toEqual([]);

      let byRemoteId = await chatChannelService.getChatChannel({
        instance: fixture.instance,
        chat,
        channelId: privateId!
      });
      expect(byRemoteId).toMatchObject({ channelId: privateId, type: 'private' });
      let byLocalId = await chatChannelService.getChatChannel({
        instance: fixture.instance,
        chat,
        channelId: byRemoteId.id
      });
      expect(byLocalId.id).toBe(byRemoteId.id);

      await expectServiceError(
        chatChannelService.getChatChannel({
          instance: fixture.instance,
          chat,
          channelId: uniqueId('missing-ch')
        }),
        'not_found'
      );

      await chatChannelServiceInternal.upsertChatChannels({
        chat,
        channels: [slateChannel(privateId!, workspaceId, { type: 'private', name: 'renamed' })]
      });
      let renamed = await chatChannelService.getChatChannel({
        instance: fixture.instance,
        chat,
        channelId: privateId!
      });
      expect(renamed).toMatchObject({ id: byRemoteId.id, name: 'renamed' });
    },
    providerTestTimeout
  );

  it(
    'stores threads and messages, orders and pages them and filters by thread',
    async () => {
      let setup = await useSetup();
      let { fixture, scope } = setup;
      let { chat, channel, channelId } = await seedChannel(setup);
      let threadId = uniqueId('th');

      let [thread] = await chatThreadServiceInternal.upsertChatThreads({
        chat,
        channel,
        threads: [slateThread(threadId, channelId)]
      });
      expect(thread).toMatchObject({ threadId, type: 'conversation' });

      let alice = slateAuthor(uniqueId('alice'));
      let messages = [
        slateMessage(uniqueId('m'), channelId, { text: 'first', author: alice }),
        slateMessage(uniqueId('m'), channelId, { text: 'second' }),
        slateMessage(uniqueId('m'), channelId, { text: 'in thread', threadId, author: alice })
      ];
      let stored = await chatMessageServiceInternal.upsertChatMessages({
        ...scope,
        chat,
        channel,
        messages
      });
      expect(stored.map(item => item.messageId)).toEqual(messages.map(item => item.id));
      expect(stored[2]!.threadOid).toBe(thread!.oid);
      expect(
        await subspaceDb.chatAuthor.count({
          where: { chatOid: chat.oid, userId: alice.userId }
        })
      ).toBe(1);

      let paginator = await chatMessageService.listChatMessages({
        instance: fixture.instance,
        chat,
        channelId
      });
      await expectConsistentPaging(
        paginator,
        stored.map(item => item.id)
      );

      let inThread = await firstPage(
        await chatMessageService.listChatMessages({
          instance: fixture.instance,
          chat,
          channelId,
          threadId
        })
      );
      expect(inThread.map(item => item.id)).toEqual([stored[2]!.id]);
      expect(
        await firstPage(
          await chatMessageService.listChatMessages({
            instance: fixture.instance,
            chat,
            channelId,
            threadId: uniqueId('missing-th')
          })
        )
      ).toEqual([]);
      expect(
        await firstPage(
          await chatMessageService.listChatMessages({
            instance: fixture.instance,
            chat,
            channelId: uniqueId('missing-ch')
          })
        )
      ).toEqual([]);

      let fetched = await chatMessageService.getChatMessage({
        instance: fixture.instance,
        chat,
        channelId,
        messageId: messages[0]!.id
      });
      expect(fetched).toMatchObject({
        id: stored[0]!.id,
        body: { parts: [{ type: 'text', content: 'first' }] }
      });
      expect(fetched.author?.userId).toBe(alice.userId);
      expect(fetched.attachments).toEqual([]);

      let threads = await firstPage(
        await chatThreadService.listChatThreads({
          instance: fixture.instance,
          chat,
          channelId
        })
      );
      expect(threads.map(item => item.id)).toEqual([thread!.id]);
      let fetchedThread = await chatThreadService.getChatThread({
        instance: fixture.instance,
        chat,
        channelId,
        threadId
      });
      expect(fetchedThread.id).toBe(thread!.id);
      await expectServiceError(
        chatThreadService.getChatThread({
          instance: fixture.instance,
          chat,
          channelId,
          threadId: uniqueId('missing-th')
        }),
        'not_found'
      );
    },
    providerTestTimeout
  );

  it(
    'updates edited messages in place and never revives deleted ones',
    async () => {
      let setup = await useSetup();
      let { fixture, scope } = setup;
      let { chat, channel, channelId } = await seedChannel(setup);
      let [keptId, deletedId] = [uniqueId('m'), uniqueId('m')];

      let [kept] = await chatMessageServiceInternal.upsertChatMessages({
        ...scope,
        chat,
        channel,
        messages: [slateMessage(keptId!, channelId, { text: 'draft' })]
      });
      let [edited] = await chatMessageServiceInternal.upsertChatMessages({
        ...scope,
        chat,
        channel,
        messages: [slateMessage(keptId!, channelId, { text: 'final' })]
      });
      expect(edited!.id).toBe(kept!.id);
      expect(edited!.body).toMatchObject({ parts: [{ content: 'final' }] });
      expect(await subspaceDb.chatMessage.count({ where: { channelOid: channel.oid } })).toBe(
        1
      );

      await chatMessageServiceInternal.upsertChatMessages({
        ...scope,
        chat,
        channel,
        messages: [slateMessage(deletedId!, channelId, { text: 'oops' })]
      });
      let tombstone = await chatMessageServiceInternal.tombstoneChatMessage({
        channel,
        messageId: deletedId!,
        threadOid: null,
        deletedAt: new Date()
      });
      expect(tombstone.deletedAt).toBeInstanceOf(Date);
      expect(tombstone.body).toBeNull();

      let [revived] = await chatMessageServiceInternal.upsertChatMessages({
        ...scope,
        chat,
        channel,
        messages: [slateMessage(deletedId!, channelId, { text: 'back again' })]
      });
      expect(revived!.id).toBe(tombstone.id);
      expect(revived!.deletedAt).toBeInstanceOf(Date);
      expect(
        (await subspaceDb.chatMessage.findUniqueOrThrow({ where: { id: tombstone.id } })).body
      ).toBeNull();

      let listed = await firstPage(
        await chatMessageService.listChatMessages({
          instance: fixture.instance,
          chat,
          channelId
        })
      );
      expect(listed.map(item => item.id)).toEqual([kept!.id]);
      await expectServiceError(
        chatMessageService.getChatMessage({
          instance: fixture.instance,
          chat,
          channelId,
          messageId: deletedId!
        }),
        'not_found'
      );

      let unseenId = uniqueId('m');
      let unseen = await chatMessageServiceInternal.tombstoneChatMessage({
        channel,
        messageId: unseenId,
        threadOid: null,
        deletedAt: new Date()
      });
      expect(unseen).toMatchObject({ messageId: unseenId, body: null });
      expect(unseen.deletedAt).toBeInstanceOf(Date);
    },
    providerTestTimeout
  );

  it(
    'reads reactions and attachments of stored messages',
    async () => {
      let setup = await useSetup();
      let { fixture, scope } = setup;
      let { chat, channel, channelId } = await seedChannel(setup);
      let messageId = uniqueId('m');
      let reactions = [
        { emoji: { type: 'unicode' as const, value: '👍' }, count: 2 },
        { emoji: { type: 'custom' as const, name: 'party' }, count: 1 }
      ];
      let attachment = {
        type: 'file' as const,
        id: uniqueId('att'),
        name: 'report.pdf',
        mimeType: 'application/pdf',
        size: 42
      };
      let message = slateMessage(messageId, channelId, {
        reactions,
        attachments: [attachment]
      });

      let [stored] = await chatMessageServiceInternal.upsertChatMessages({
        ...scope,
        chat,
        channel,
        messages: [message]
      });
      await chatMessageServiceInternal.upsertChatMessages({
        ...scope,
        chat,
        channel,
        messages: [message]
      });

      let listed = await chatReactionService.listChatReactions({
        instance: fixture.instance,
        chat,
        channelId,
        messageId
      });
      expect(listed.reactions).toEqual(reactions);
      expect(
        await chatReactionService.listChatReactions({
          instance: fixture.instance,
          chat,
          channelId: uniqueId('missing-ch'),
          messageId
        })
      ).toEqual({ reactions: [] });

      let attachments = await subspaceDb.chatMessageAttachment.findMany({
        where: { messageOid: stored!.oid }
      });
      expect(attachments).toHaveLength(1);
      expect(attachments[0]).toMatchObject({
        attachmentId: attachment.id,
        name: 'report.pdf',
        mimeType: 'application/pdf',
        position: 0
      });

      let fetched = await chatMessageService.getChatMessage({
        instance: fixture.instance,
        chat,
        channelId,
        messageId
      });
      expect(fetched.attachments).toHaveLength(1);
      expect(fetched.attachments[0]).toMatchObject({
        attachmentId: attachment.id,
        fileId: attachments[0]!.fileId
      });
      expect(fetched.attachments[0]!.file?.id).toBe(attachments[0]!.fileId);
    },
    providerTestTimeout
  );

  it(
    'rejects platform writes the provider does not support without calling it',
    async () => {
      let setup = await useSetup();
      let { fixture, chatInstanceProvider, scope } = setup;
      let { chat, channel, channelId } = await seedChannel(setup);
      let messageId = uniqueId('m');
      await chatMessageServiceInternal.upsertChatMessages({
        ...scope,
        chat,
        channel,
        messages: [slateMessage(messageId, channelId)]
      });
      let instance = fixture.instance;
      let body = { parts: [{ type: 'text' as const, content: 'hello' }] };
      let toolCallsBefore = server.toolCalls().length;
      let eventsBefore = await subspaceDb.chatEvent.count({ where: { chatOid: chat.oid } });

      await expectServiceError(
        chatMessageService.sendChatMessage({ instance, chat, channelId, body }),
        'chat_message_send_not_supported'
      );
      await expectServiceError(
        chatMessageService.sendChatMessage({
          instance,
          chat,
          channelId,
          body,
          ephemeral: { targetUserId: 'u-1' }
        }),
        'chat_message_send_ephemeral_not_supported'
      );
      await expectServiceError(
        chatMessageService.editChatMessage({ instance, chat, channelId, messageId, body }),
        'chat_message_edit_not_supported'
      );
      await expectServiceError(
        chatMessageService.deleteChatMessage({ instance, chat, channelId, messageId }),
        'chat_message_delete_not_supported'
      );
      await expectServiceError(
        chatMessageService.markChatMessageRead({ instance, chat, channelId, messageId }),
        'chat_message_mark_read_not_supported'
      );
      await expectServiceError(
        chatMessageService.listChatMessages({ instance, chat, channelId, search: 'hello' }),
        'chat_message_search_not_supported'
      );
      await expectServiceError(
        chatReactionService.addChatReaction({
          instance,
          chat,
          channelId,
          messageId,
          emoji: '👍'
        }),
        'chat_message_reaction_add_not_supported'
      );
      await expectServiceError(
        chatReactionService.removeChatReaction({
          instance,
          chat,
          channelId,
          messageId,
          emoji: '👍'
        }),
        'chat_message_reaction_remove_not_supported'
      );
      await expectServiceError(
        chatDmService.openSingleDm({
          instance,
          chat,
          input: { type: 'generic', userId: 'u-1' }
        }),
        'chat_dm_open_single_not_supported'
      );
      await expectServiceError(
        chatDmService.openGroupDm({
          instance,
          chat,
          input: { type: 'generic', userIds: ['u-1', 'u-2'] }
        }),
        'chat_dm_open_group_not_supported'
      );
      await expectServiceError(
        chatTypingService.startTyping({ instance, chat, channel }),
        'chat_typing_not_supported'
      );
      await expectServiceError(
        chatChannelMemberService.listChatChannelMembers({ instance, chat, channelId }),
        'chat_channel_members_read_not_supported'
      );
      await expectServiceError(
        chatChannelMemberService.getChatChannelMember({
          instance,
          chat,
          channelId,
          userId: 'u-1'
        }),
        'chat_user_read_not_supported'
      );
      await expectServiceError(
        chatUserService.getAuthenticatedChatUser({ instance, chatInstanceProvider }),
        'chat_user_self_read_not_supported'
      );

      expect(server.toolCalls()).toHaveLength(toolCallsBefore);
      expect(await subspaceDb.chatMessage.count({ where: { channelOid: channel.oid } })).toBe(
        1
      );
      expect(await subspaceDb.chatEvent.count({ where: { chatOid: chat.oid } })).toBe(
        eventsBefore
      );
    },
    providerTestTimeout
  );

  it(
    'archives chats with their instance and deletes their content through the delete queues',
    async () => {
      let setup = await createSetup();
      let { fixture, scope, chatInstance } = setup;
      let first = await seedChannel(setup);
      let second = await seedChannel(setup);
      for (let seeded of [first, second]) {
        await chatMessageServiceInternal.upsertChatMessages({
          ...scope,
          chat: seeded.chat,
          channel: seeded.channel,
          messages: [slateMessage(uniqueId('m'), seeded.channelId)]
        });
      }

      await chatInstanceService.archiveChatInstance({
        instance: fixture.instance,
        chatInstance
      });

      for (let seeded of [first, second]) {
        expect(
          await subspaceDb.chat.findUniqueOrThrow({
            where: { oid: seeded.chat.oid },
            select: { status: true, isParentDeleted: true }
          })
        ).toEqual({ status: 'archived', isParentDeleted: true });
      }
      expect(
        await firstPage(
          await chatService.listChats({
            instance: fixture.instance,
            chatInstanceIds: [chatInstance.id]
          })
        )
      ).toEqual([]);
      await expectServiceError(
        chatService.getChatById({ instance: fixture.instance, chatId: first.chat.id }),
        'not_found'
      );
      let archivedChat = await chatService.getChatById({
        instance: fixture.instance,
        chatId: first.chat.id,
        allowDeleted: true
      });
      expect(archivedChat.status).toBe('archived');

      await chatDeleteQueue.add({ chatId: first.chat.id });
      await eventually(async () => {
        let chat = await subspaceDb.chat.findUniqueOrThrow({ where: { oid: first.chat.oid } });
        expect(chat).toMatchObject({ status: 'deleted', name: '[deleted]' });
      }, workerTimeout);
      expect(await subspaceDb.chatChannel.count({ where: { chatOid: first.chat.oid } })).toBe(
        0
      );
      expect(
        await subspaceDb.chatMessage.count({ where: { channelOid: first.channel.oid } })
      ).toBe(0);
      expect(await subspaceDb.chatAuthor.count({ where: { chatOid: first.chat.oid } })).toBe(
        0
      );
      expect(
        await subspaceDb.chatWorkspace.count({ where: { chatOid: first.chat.oid } })
      ).toBe(0);
      expect(
        (await subspaceDb.chat.findUniqueOrThrow({ where: { oid: second.chat.oid } })).status
      ).toBe('archived');

      await chatInstanceDeleteQueue.add({ chatInstanceId: chatInstance.id });
      await eventually(async () => {
        let row = await subspaceDb.chatInstance.findUniqueOrThrow({
          where: { id: chatInstance.id }
        });
        expect(row).toMatchObject({ status: 'deleted', name: '[deleted]' });
      }, workerTimeout);
      expect(
        (await subspaceDb.chat.findUniqueOrThrow({ where: { oid: second.chat.oid } })).status
      ).toBe('deleted');
      expect(await subspaceDb.chatChannel.count({ where: { chatOid: second.chat.oid } })).toBe(
        0
      );
      expect(
        (
          await subspaceDb.chatInstanceProvider.findUniqueOrThrow({
            where: { id: setup.chatInstanceProvider.id }
          })
        ).status
      ).toBe('deleted');
    },
    providerTestTimeout
  );

  it(
    'keeps chats and their content private to their organization',
    async () => {
      let setup = await useSetup();
      let otherFixture = await loadOrganizationFixture(otherOrg.ids);
      let { chat, channelId } = await seedChannel(setup);
      let instance = otherFixture.instance;

      await expectServiceError(
        chatService.getChatById({ instance, chatId: chat.id }),
        'not_found'
      );
      expect(
        await firstPage(await chatService.listChats({ instance, ids: [chat.id] }))
      ).toEqual([]);
      expect(
        await firstPage(
          await chatEventService.listChatEvents({ instance, chatIds: [chat.id] })
        )
      ).toEqual([]);

      await expect(chatChannelService.listChatChannels({ instance, chat })).rejects.toThrow(
        'Tenant mismatch'
      );
      await expect(
        chatChannelService.getChatChannel({ instance, chat, channelId })
      ).rejects.toThrow('Tenant mismatch');
      await expect(
        chatMessageService.listChatMessages({ instance, chat, channelId })
      ).rejects.toThrow('Tenant mismatch');
      await expect(
        chatThreadService.listChatThreads({ instance, chat, channelId })
      ).rejects.toThrow('Tenant mismatch');
      await expect(
        chatWorkspaceService.getChatWorkspace({
          instance,
          chatInstanceProvider: chat.chatInstanceProvider,
          workspaceId: uniqueId('ws')
        })
      ).rejects.toThrow('Tenant mismatch');
    },
    providerTestTimeout
  );
});
