import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type Channel,
  type ChatAdapterInstance,
  type ChatBody,
  type ChatPart,
  type Message,
  type ReplyRef,
  type Thread
} from '@metorial-subspace/adapter-chat';
import { type ChatChannel, db, type Environment, type Tenant } from '@metorial-subspace/db';
import {
  checkTenant,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { chatAdapterService } from '../internal/chatAdapter';
import { chatChannelServiceInternal } from '../internal/chatChannel';
import {
  chatMessageServiceInternal,
  type ChatMessageWithRelations
} from '../internal/chatMessage';
import { chatThreadServiceInternal } from '../internal/chatThread';
import {
  assertChatCapability,
  requireLocalChatEntity,
  withChatCapabilityFallback
} from '../lib/chatCapability';
import { unwrapChatCall } from '../lib/chatError';
import { type ChatWithProvider } from './chatChannel';

export type ListChatMessagesParams = {
  chat: ChatWithProvider;
  channelId: string;
  threadId?: string;
  search?: string;
};

export type GetChatMessageParams = {
  chat: ChatWithProvider;
  channelId: string;
  messageId: string;
};

export type SendChatMessageBody = {
  parts: ChatPart[];
  altText?: string;
};

export type SendChatMessageParams = {
  chat: ChatWithProvider;
  channelId: string;
  threadId?: string;
  body: SendChatMessageBody;
  reply?: { messageId: string };
  ephemeral?: { targetUserId: string };
};

export type EditChatMessageParams = {
  chat: ChatWithProvider;
  channelId: string;
  messageId: string;
  body: SendChatMessageBody;
};

export type DeleteChatMessageParams = {
  chat: ChatWithProvider;
  channelId: string;
  messageId: string;
};

export type MarkChatMessageReadParams = {
  chat: ChatWithProvider;
  channelId: string;
  messageId: string;
  threadId?: string;
};

let assertMessageSendCapability = (client: ChatAdapterInstance) =>
  assertChatCapability(client, 'message_send', {
    message: 'This chat provider does not support sending messages.'
  });

let assertMessageSendEphemeralCapability = (client: ChatAdapterInstance) =>
  assertChatCapability(client, 'message_send_ephemeral', {
    message: 'This chat provider does not support sending ephemeral messages.'
  });

let assertMessageReplyCapability = (client: ChatAdapterInstance) =>
  assertChatCapability(client, 'thread_posts', {
    code: 'chat_message_reply_not_supported',
    message: 'This chat provider does not support replying to messages.'
  });

let assertMessageEditCapability = (client: ChatAdapterInstance) =>
  assertChatCapability(client, 'message_edit', {
    message: 'This chat provider does not support editing messages.'
  });

let assertMessageDeleteCapability = (client: ChatAdapterInstance) =>
  assertChatCapability(client, 'message_delete', {
    message: 'This chat provider does not support deleting messages.'
  });

let assertMessageMarkReadCapability = (client: ChatAdapterInstance) =>
  assertChatCapability(client, 'message_mark_read', {
    message: 'This chat provider does not support marking messages as read.'
  });

let assertMessageSearchCapability = (client: ChatAdapterInstance) =>
  assertChatCapability(client, 'message_search', {
    message: 'This chat provider does not support searching messages.'
  });

class chatMessageServiceImpl {
  async listChatMessages(d: MetorialFacing<ListChatMessagesParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.listChatMessagesInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listChatMessagesInternal(
    d: { tenant: Tenant; environment: Environment } & ListChatMessagesParams
  ) {
    checkTenant(d, d.chat.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });

    let search = d.search?.trim() || undefined;
    if (search) {
      assertMessageSearchCapability(client);
      return this.listChatMessagesFromSearch({ ...d, search, client });
    }

    return withChatCapabilityFallback(client, 'message_read', {
      provider: () => this.listChatMessagesFromProvider({ ...d, client }),
      fallback: () => this.listChatMessagesFromDb(d)
    });
  }

  private async listChatMessagesFromProvider(
    d: ListChatMessagesParams & { client: ChatAdapterInstance }
  ) {
    let localChannel = await db.chatChannel.findFirst({
      where: {
        chatOid: d.chat.oid,
        OR: [{ id: d.channelId }, { channelId: d.channelId }]
      }
    });
    let channelId = localChannel?.channelId ?? d.channelId;

    let localThread =
      d.threadId && localChannel
        ? await db.chatThread.findFirst({
            where: {
              channelOid: localChannel.oid,
              OR: [{ id: d.threadId }, { threadId: d.threadId }]
            }
          })
        : null;
    let threadId = localThread?.threadId ?? d.threadId;

    return Paginator.create(({ externalCursor }) =>
      externalCursor(async page => {
        let listed = await d.client.call('metorial_chat$message.list', {
          cursor: page.cursor,
          limit: page.limit,
          direction: page.direction,
          channelId,
          threadId
        });
        let listing = unwrapChatCall(listed, {
          code: 'chat_message_list_failed',
          message: 'Failed to list messages from the chat provider.'
        });

        let channel = listing.channel
          ? (
              await chatChannelServiceInternal.upsertChatChannels({
                chat: d.chat,
                channels: [listing.channel]
              })
            )[0]
          : localChannel;
        if (!channel) throw new ServiceError(notFoundError('chatChannel', channelId));

        if (listing.thread) {
          await chatThreadServiceInternal.upsertChatThreads({
            chat: d.chat,
            channel,
            threads: [listing.thread]
          });
        }

        let upserted = await chatMessageServiceInternal.upsertChatMessages({
          chat: d.chat,
          channel,
          messages: listing.messages
        });

        return {
          items: upserted,
          nextCursor: listing.nextCursor,
          prevCursor: listing.prevCursor
        };
      })
    );
  }

  private async listChatMessagesFromSearch(
    d: ListChatMessagesParams & { search: string; client: ChatAdapterInstance }
  ) {
    let localChannel = await db.chatChannel.findFirst({
      where: {
        chatOid: d.chat.oid,
        OR: [{ id: d.channelId }, { channelId: d.channelId }]
      }
    });
    let channelId = localChannel?.channelId ?? d.channelId;

    return Paginator.create(({ externalCursor }) =>
      externalCursor(async page => {
        let searched = await d.client.call('metorial_chat$message.search', {
          cursor: page.cursor,
          limit: page.limit,
          direction: page.direction,
          query: d.search,
          channelId
        });
        let listing = unwrapChatCall(searched, {
          code: 'chat_message_search_failed',
          message: 'Failed to search messages with the chat provider.'
        });

        let channel = listing.channel
          ? (
              await chatChannelServiceInternal.upsertChatChannels({
                chat: d.chat,
                channels: [listing.channel]
              })
            )[0]
          : localChannel;
        if (!channel) throw new ServiceError(notFoundError('chatChannel', channelId));

        if (listing.thread) {
          await chatThreadServiceInternal.upsertChatThreads({
            chat: d.chat,
            channel,
            threads: [listing.thread]
          });
        }

        let upserted = await chatMessageServiceInternal.upsertChatMessages({
          chat: d.chat,
          channel,
          messages: listing.messages
        });

        return {
          items: upserted,
          nextCursor: listing.nextCursor,
          prevCursor: listing.prevCursor
        };
      })
    );
  }

  private async listChatMessagesFromDb(d: ListChatMessagesParams) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let localChannel = await db.chatChannel.findFirst({
          where: {
            chatOid: d.chat.oid,
            OR: [{ id: d.channelId }, { channelId: d.channelId }]
          }
        });
        if (!localChannel) return [];

        let threadOid: bigint | undefined;
        if (d.threadId) {
          let localThread = await db.chatThread.findFirst({
            where: {
              channelOid: localChannel.oid,
              OR: [{ id: d.threadId }, { threadId: d.threadId }]
            }
          });
          // No local match for the requested thread -- there can be no messages for it.
          if (!localThread) return [];
          threadOid = localThread.oid;
        }

        let messages = await db.chatMessage.findMany({
          ...opts,
          where: {
            channelOid: localChannel.oid,
            ...(threadOid !== undefined ? { threadOid } : {})
          }
        });

        let threadOids = [
          ...new Set(
            messages.map(message => message.threadOid).filter((oid): oid is bigint => !!oid)
          )
        ];
        let threads = threadOids.length
          ? await db.chatThread.findMany({ where: { oid: { in: threadOids } } })
          : [];
        let threadByOid = new Map(threads.map(thread => [thread.oid, thread]));

        return messages.map(message => ({
          ...message,
          chat: d.chat,
          channel: localChannel!,
          thread: message.threadOid ? (threadByOid.get(message.threadOid) ?? null) : null
        }));
      })
    );
  }

  async getChatMessage(d: MetorialFacing<GetChatMessageParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.getChatMessageInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getChatMessageInternal(
    d: { tenant: Tenant; environment: Environment } & GetChatMessageParams
  ) {
    checkTenant(d, d.chat.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });

    return withChatCapabilityFallback(client, 'message_read', {
      provider: () => this.getChatMessageFromProvider({ ...d, client }),
      fallback: () => this.getChatMessageFromDb(d)
    });
  }

  private async getChatMessageFromProvider(
    d: GetChatMessageParams & { client: ChatAdapterInstance }
  ) {
    let localChannel = await db.chatChannel.findFirst({
      where: {
        chatOid: d.chat.oid,
        OR: [{ id: d.channelId }, { channelId: d.channelId }]
      }
    });
    let channelId = localChannel?.channelId ?? d.channelId;

    let localMessage = localChannel
      ? await db.chatMessage.findFirst({
          where: {
            channelOid: localChannel.oid,
            OR: [{ id: d.messageId }, { messageId: d.messageId }]
          }
        })
      : null;
    let messageId = localMessage?.messageId ?? d.messageId;

    let got = await d.client.call('metorial_chat$message.get', { channelId, messageId });
    let result = unwrapChatCall(got, {
      code: 'chat_message_get_failed',
      message: 'Failed to load the message from the chat provider.'
    });

    return this.persistMessageResult(d.chat, localChannel, result);
  }

  private async getChatMessageFromDb(d: GetChatMessageParams) {
    let localChannel = await db.chatChannel.findFirst({
      where: {
        chatOid: d.chat.oid,
        OR: [{ id: d.channelId }, { channelId: d.channelId }]
      }
    });
    if (!localChannel) throw new ServiceError(notFoundError('chatMessage', d.messageId));

    let local = await db.chatMessage.findFirst({
      where: {
        channelOid: localChannel.oid,
        OR: [{ id: d.messageId }, { messageId: d.messageId }]
      }
    });

    let thread = local?.threadOid
      ? await db.chatThread.findUnique({ where: { oid: local.threadOid } })
      : null;

    let withRelations: ChatMessageWithRelations | null = local
      ? { ...local, chat: d.chat, channel: localChannel, thread }
      : null;

    return requireLocalChatEntity('chatMessage', d.messageId, withRelations);
  }

  async sendChatMessage(d: MetorialFacing<SendChatMessageParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.sendChatMessageInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async sendChatMessageInternal(
    d: { tenant: Tenant; environment: Environment } & SendChatMessageParams
  ) {
    checkTenant(d, d.chat.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });

    if (d.ephemeral) assertMessageSendEphemeralCapability(client);
    else assertMessageSendCapability(client);

    let localChannel = await db.chatChannel.findFirst({
      where: {
        chatOid: d.chat.oid,
        OR: [{ id: d.channelId }, { channelId: d.channelId }]
      }
    });
    let channelId = localChannel?.channelId ?? d.channelId;

    let localThread =
      d.threadId && localChannel
        ? await db.chatThread.findFirst({
            where: {
              channelOid: localChannel.oid,
              OR: [{ id: d.threadId }, { threadId: d.threadId }]
            }
          })
        : null;
    let threadId = localThread?.threadId ?? d.threadId;

    let reply: ReplyRef | undefined;
    if (d.reply) {
      assertMessageReplyCapability(client);

      let resolved = await this.getChatMessageInternal({
        tenant: d.tenant,
        environment: d.environment,
        chat: d.chat,
        channelId: d.channelId,
        messageId: d.reply.messageId
      });

      reply = {
        id: resolved.messageId,
        reference: {
          id: resolved.messageId,
          channelId: resolved.channel.channelId,
          threadId: resolved.thread?.threadId,
          body: resolved.body as ChatBody
        }
      };
    }

    let sent = d.ephemeral
      ? await client.call('metorial_chat$message.sendEphemeral', {
          parts: d.body.parts,
          altText: d.body.altText,
          channelId,
          userId: d.ephemeral.targetUserId,
          threadId
        })
      : await client.call('metorial_chat$message.send', {
          parts: d.body.parts,
          altText: d.body.altText,
          channelId,
          threadId,
          reply
        });

    let result = unwrapChatCall(sent, {
      code: 'chat_message_send_failed',
      message: 'Failed to send the message with the chat provider.'
    });

    return this.persistMessageResult(d.chat, localChannel, result);
  }

  async editChatMessage(d: MetorialFacing<EditChatMessageParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.editChatMessageInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async editChatMessageInternal(
    d: { tenant: Tenant; environment: Environment } & EditChatMessageParams
  ) {
    checkTenant(d, d.chat.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });

    assertMessageEditCapability(client);

    let localChannel = await db.chatChannel.findFirst({
      where: {
        chatOid: d.chat.oid,
        OR: [{ id: d.channelId }, { channelId: d.channelId }]
      }
    });
    let channelId = localChannel?.channelId ?? d.channelId;

    let localMessage = localChannel
      ? await db.chatMessage.findFirst({
          where: {
            channelOid: localChannel.oid,
            OR: [{ id: d.messageId }, { messageId: d.messageId }]
          }
        })
      : null;
    let messageId = localMessage?.messageId ?? d.messageId;

    let edited = await client.call('metorial_chat$message.edit', {
      parts: d.body.parts,
      altText: d.body.altText,
      channelId,
      messageId
    });
    let result = unwrapChatCall(edited, {
      code: 'chat_message_edit_failed',
      message: 'Failed to edit the message with the chat provider.'
    });

    return this.persistMessageResult(d.chat, localChannel, result);
  }

  async deleteChatMessage(d: MetorialFacing<DeleteChatMessageParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.deleteChatMessageInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async deleteChatMessageInternal(
    d: { tenant: Tenant; environment: Environment } & DeleteChatMessageParams
  ) {
    checkTenant(d, d.chat.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });

    assertMessageDeleteCapability(client);

    let localChannel = await db.chatChannel.findFirst({
      where: {
        chatOid: d.chat.oid,
        OR: [{ id: d.channelId }, { channelId: d.channelId }]
      }
    });
    let channelId = localChannel?.channelId ?? d.channelId;

    let localMessage = localChannel
      ? await db.chatMessage.findFirst({
          where: {
            channelOid: localChannel.oid,
            OR: [{ id: d.messageId }, { messageId: d.messageId }]
          }
        })
      : null;
    let messageId = localMessage?.messageId ?? d.messageId;

    let deleted = await client.call('metorial_chat$message.delete', { channelId, messageId });
    let result = unwrapChatCall(deleted, {
      code: 'chat_message_delete_failed',
      message: 'Failed to delete the message with the chat provider.'
    });

    if (localChannel) {
      await db.chatMessage.deleteMany({
        where: { channelOid: localChannel.oid, messageId }
      });
    }

    return result;
  }

  async markChatMessageRead(d: MetorialFacing<MarkChatMessageReadParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.markChatMessageReadInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async markChatMessageReadInternal(
    d: { tenant: Tenant; environment: Environment } & MarkChatMessageReadParams
  ) {
    checkTenant(d, d.chat.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });

    assertMessageMarkReadCapability(client);

    let localChannel = await db.chatChannel.findFirst({
      where: {
        chatOid: d.chat.oid,
        OR: [{ id: d.channelId }, { channelId: d.channelId }]
      }
    });
    let channelId = localChannel?.channelId ?? d.channelId;

    let localMessage = localChannel
      ? await db.chatMessage.findFirst({
          where: {
            channelOid: localChannel.oid,
            OR: [{ id: d.messageId }, { messageId: d.messageId }]
          }
        })
      : null;
    let messageId = localMessage?.messageId ?? d.messageId;

    let localThread =
      d.threadId && localChannel
        ? await db.chatThread.findFirst({
            where: {
              channelOid: localChannel.oid,
              OR: [{ id: d.threadId }, { threadId: d.threadId }]
            }
          })
        : null;
    let threadId = localThread?.threadId ?? d.threadId;

    let marked = await client.call('metorial_chat$message.markRead', {
      channelId,
      messageId,
      threadId
    });

    return unwrapChatCall(marked, {
      code: 'chat_message_mark_read_failed',
      message: 'Failed to mark the message as read with the chat provider.'
    });
  }

  private async persistMessageResult(
    chat: ChatWithProvider,
    localChannel: ChatChannel | null,
    result: { message: Message; channel?: Channel; thread?: Thread }
  ): Promise<ChatMessageWithRelations> {
    let channel = result.channel
      ? (
          await chatChannelServiceInternal.upsertChatChannels({
            chat,
            channels: [result.channel]
          })
        )[0]
      : localChannel;
    if (!channel)
      throw new ServiceError(notFoundError('chatChannel', result.message.channelId));

    if (result.thread) {
      await chatThreadServiceInternal.upsertChatThreads({
        chat,
        channel,
        threads: [result.thread]
      });
    }

    let [upserted] = await chatMessageServiceInternal.upsertChatMessages({
      chat,
      channel,
      messages: [result.message]
    });

    return upserted!;
  }
}

export let chatMessageService = Service.create(
  'chatMessageService',
  () => new chatMessageServiceImpl()
).build();
