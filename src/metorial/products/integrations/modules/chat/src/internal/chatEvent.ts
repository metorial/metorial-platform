import { Service } from '@lowerdeck/service';
import {
  type Channel,
  chatTriggers,
  type Emoji,
  type Message,
  type ReactionCount,
  type Thread
} from '@metorial-subspace/adapter-chat';
import {
  type Chat,
  type ChatChannel,
  type ChatEvent,
  type ChatInstanceProvider,
  type ChatMessage,
  type ChatThread,
  db,
  type Environment,
  getId,
  type Tenant
} from '@metorial-subspace/db';
import { callbackEventInternalService } from '@metorial-subspace/module-callback';
import { db as metorialDb } from '@metorial/db';
import { eventTrackerService } from '@metorial/module-event-tracker';
import { usingChatMessageLock } from '../lib/chatLock';
import { isUniqueConstraintError } from '../lib/unique';
import { chatChannelServiceInternal } from './chatChannel';
import { chatEventPayloadServiceInternal } from './chatEventPayload';
import { chatMessageServiceInternal } from './chatMessage';
import { chatThreadServiceInternal } from './chatThread';

export let chatAdapterIdentifier = 'chat';

let triggerByKey = new Map(
  Object.values(chatTriggers).map(trigger => [trigger.key as string, trigger])
);

type ChatTriggerPayload = {
  type: string;
  id: string;
  message?: Message;
  channel?: Channel;
  thread?: Thread;
  channelId?: string;
  messageId?: string;
  threadId?: string;
  emoji?: Emoji;
  author?: { userId: string };
};

let emojiKey = (emoji: Emoji) =>
  emoji.type === 'unicode' ? `unicode:${emoji.value}` : `custom:${emoji.id ?? emoji.name}`;

let applyReactionDelta = (
  reactions: ReactionCount[],
  emoji: Emoji,
  delta: 1 | -1
): ReactionCount[] => {
  let key = emojiKey(emoji);
  let next = reactions.map(reaction =>
    emojiKey(reaction.emoji) === key
      ? { ...reaction, count: Math.max(0, reaction.count + delta) }
      : reaction
  );

  if (delta === 1 && !next.some(reaction => emojiKey(reaction.emoji) === key)) {
    next.push({ emoji, count: 1 });
  }

  return next.filter(reaction => reaction.count > 0);
};

class chatEventInternalServiceImpl {
  async ingestCallbackEvent(d: { callbackEventId: string }) {
    let callbackEvent = await db.callbackEvent.findUnique({
      where: { id: d.callbackEventId },
      include: {
        callback: { include: { managedAdapterGlobal: true } },
        callbackInstance: true,
        tenant: true,
        environment: true
      }
    });
    if (!callbackEvent) return;

    if (
      callbackEvent.callback.ownership !== 'managed' ||
      callbackEvent.callback.managedAdapterGlobal?.identifier !== chatAdapterIdentifier
    ) {
      return;
    }

    let trigger = triggerByKey.get(callbackEvent.providerTriggerKey);
    if (!trigger) {
      console.warn(
        `CHAT.event.ingest.unknownTrigger callbackEventId=${callbackEvent.id} triggerKey=${callbackEvent.providerTriggerKey}`
      );
      return;
    }

    let providers = await db.chatInstanceProvider.findMany({
      where: {
        status: 'active',
        isParentDeleted: false,
        chatInstance: { status: 'active' },
        adapterIntegrationInstanceProvider: {
          integrationInstanceProviderOid:
            callbackEvent.callbackInstance.integrationInstanceProviderOid,
          status: 'active'
        }
      }
    });
    if (providers.length === 0) return;

    let rawPayload = await callbackEventInternalService.getEventPayload({
      tenant: callbackEvent.tenant,
      callback: callbackEvent.callback,
      callbackEvent
    });
    if (!rawPayload) {
      console.warn(`CHAT.event.ingest.noPayload callbackEventId=${callbackEvent.id}`);
      return;
    }

    let parsed = trigger.output.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(
        `CHAT.event.ingest.invalidPayload callbackEventId=${callbackEvent.id} triggerKey=${callbackEvent.providerTriggerKey}`
      );
      return;
    }

    let payload = parsed.data as ChatTriggerPayload;

    for (let chatInstanceProvider of providers) {
      await this.ingestForProvider({
        tenant: callbackEvent.tenant,
        environment: callbackEvent.environment,
        chatInstanceProvider,
        callbackEvent,
        payload
      });
    }
  }

  private async resolveChat(d: {
    chatInstanceProvider: ChatInstanceProvider;
    payload: ChatTriggerPayload;
  }) {
    let workspaceId = d.payload.channel?.workspaceId;
    if (workspaceId) {
      let workspace = await db.chatWorkspace.findUnique({
        where: {
          chatInstanceProviderOid_workspaceId: {
            chatInstanceProviderOid: d.chatInstanceProvider.oid,
            workspaceId
          }
        },
        include: { chat: true }
      });
      return workspace?.chat ?? null;
    }

    let chats = await db.chat.findMany({
      where: {
        chatInstanceProviderOid: d.chatInstanceProvider.oid,
        status: 'active'
      },
      take: 2
    });

    // Without a workspace on the payload the chat is only unambiguous when the provider has a
    // single one; anything else would be a guess.
    return chats.length === 1 ? chats[0]! : null;
  }

  private async ingestForProvider(d: {
    tenant: Tenant;
    environment: Environment;
    chatInstanceProvider: ChatInstanceProvider;
    callbackEvent: {
      oid: bigint;
      id: string;
      source: 'webhook' | 'polling';
      occurredAt: Date;
    };
    payload: ChatTriggerPayload;
  }) {
    let chat = await this.resolveChat(d);
    if (!chat) {
      console.warn(
        `CHAT.event.ingest.noChat callbackEventId=${d.callbackEvent.id} chatInstanceProviderId=${d.chatInstanceProvider.id}`
      );
      return;
    }

    await usingChatMessageLock(chat.oid, async () => {
      let persisted = await this.persist({
        ...d,
        chat,
        occurredAt: d.callbackEvent.occurredAt
      });
      await this.recordChatEvent({ ...d, chat, persisted });
    });
  }

  private async persist(d: {
    tenant: Tenant;
    environment: Environment;
    chat: Chat;
    payload: ChatTriggerPayload;
    occurredAt: Date;
  }): Promise<{
    channel: ChatChannel | null;
    thread: ChatThread | null;
    message: ChatMessage | null;
  }> {
    let payload = d.payload;

    let channel = payload.channel
      ? ((
          await chatChannelServiceInternal.upsertChatChannels({
            chat: d.chat,
            channels: [payload.channel]
          })
        )[0] ?? null)
      : await this.findChannel(d.chat, payload.channelId ?? payload.message?.channelId);

    if (payload.thread && channel) {
      await chatThreadServiceInternal.upsertChatThreads({
        chat: d.chat,
        channel,
        threads: [payload.thread]
      });
    }

    if (payload.message) {
      let upserted = await chatMessageServiceInternal.persistMessageResult({
        tenant: d.tenant,
        environment: d.environment,
        chat: d.chat,
        localChannel: channel,
        result: { message: payload.message, channel: payload.channel, thread: payload.thread }
      });
      return { channel: upserted.channel, thread: upserted.thread, message: upserted };
    }

    let message =
      channel && payload.messageId ? await this.findMessage(channel, payload.messageId) : null;
    let thread =
      channel && payload.threadId ? await this.findThread(channel, payload.threadId) : null;

    if (payload.type === 'chat.message.deleted' && channel && payload.messageId) {
      message = await chatMessageServiceInternal.tombstoneChatMessage({
        channel,
        messageId: payload.messageId,
        threadOid: thread?.oid ?? null,
        deletedAt: d.occurredAt
      });
    }

    if (
      message &&
      payload.emoji &&
      (payload.type === 'chat.reaction.added' || payload.type === 'chat.reaction.removed')
    ) {
      let reactions = applyReactionDelta(
        (message.reactions as ReactionCount[] | null) ?? [],
        payload.emoji,
        payload.type === 'chat.reaction.added' ? 1 : -1
      );

      message = await db.chatMessage.update({
        where: { oid: message.oid },
        data: { reactions: reactions as any }
      });
    }

    return { channel, thread, message };
  }

  private findChannel(chat: Chat, channelId: string | undefined) {
    if (!channelId) return null;
    return db.chatChannel.findUnique({
      where: { chatOid_channelId: { chatOid: chat.oid, channelId } }
    });
  }

  private findMessage(channel: ChatChannel, messageId: string) {
    return db.chatMessage.findUnique({
      where: { channelOid_messageId: { channelOid: channel.oid, messageId } }
    });
  }

  private findThread(channel: ChatChannel, threadId: string) {
    return db.chatThread.findUnique({
      where: { channelOid_threadId: { channelOid: channel.oid, threadId } }
    });
  }

  private async recordChatEvent(d: {
    chat: Chat;
    chatInstanceProvider: ChatInstanceProvider;
    callbackEvent: { oid: bigint; source: 'webhook' | 'polling'; occurredAt: Date };
    payload: ChatTriggerPayload;
    persisted: {
      channel: ChatChannel | null;
      thread: ChatThread | null;
      message: ChatMessage | null;
    };
  }) {
    let messageAuthorOid = d.persisted.message?.authorOid;
    let author = messageAuthorOid
      ? await db.chatAuthor.findUnique({ where: { oid: messageAuthorOid } })
      : d.payload.author
        ? await db.chatAuthor.findUnique({
            where: { chatOid_userId: { chatOid: d.chat.oid, userId: d.payload.author.userId } }
          })
        : null;

    let provider = d.chatInstanceProvider;

    let payload = await chatEventPayloadServiceInternal.buildChatEventPayload({
      chat: d.chat,
      channel: d.persisted.channel,
      thread: d.persisted.thread,
      message: d.persisted.message,
      author
    });

    try {
      let chatEvent = await db.chatEvent.create({
        data: {
          ...getId('chatEvent'),
          type: d.payload.type,
          source: d.callbackEvent.source,
          providerEventId: d.payload.id,

          chatOid: d.chat.oid,
          chatConnectionOid: provider.chatConnectionOid,
          chatInstanceOid: provider.chatInstanceOid,
          chatInstanceProviderOid: provider.oid,

          channelOid: d.persisted.channel?.oid,
          threadOid: d.persisted.thread?.oid,
          messageOid: d.persisted.message?.oid,
          authorOid: author?.oid,

          providerChannelId:
            d.persisted.channel?.channelId ??
            d.payload.channelId ??
            d.payload.message?.channelId,
          providerThreadId: d.persisted.thread?.threadId ?? d.payload.threadId,
          providerMessageId: d.persisted.message?.messageId ?? d.payload.messageId,
          providerAuthorId: author?.userId ?? d.payload.author?.userId,

          callbackEventOid: d.callbackEvent.oid,
          payload,

          tenantOid: provider.tenantOid,
          projectOid: provider.projectOid,
          environmentOid: provider.environmentOid,
          instanceOid: provider.instanceOid,
          solutionOid: provider.solutionOid,

          occurredAt: d.callbackEvent.occurredAt
        }
      });
      await this.trackSystemEvent({
        chatEvent,
        chatConnectionOid: provider.chatConnectionOid
      });
    } catch (err) {
      // Replaying the same callback event for the same chat must stay a no-op.
      if (!isUniqueConstraintError(err)) throw err;
    }
  }

  private async trackSystemEvent(d: { chatEvent: ChatEvent; chatConnectionOid: bigint }) {
    let instance = await metorialDb.instance.findUnique({
      where: { oid: d.chatEvent.instanceOid }
    });
    if (!instance) return;

    let chatConnection = await db.chatConnection.findUniqueOrThrow({
      where: { oid: d.chatConnectionOid },
      select: { id: true }
    });

    await eventTrackerService.recordChatEvent({
      organizationOid: instance.organizationOid,
      instanceOid: instance.oid,
      chatEventId: d.chatEvent.id,
      chatIntegrationId: chatConnection.id,
      eventType: d.chatEvent.type
    });
  }
}

export let chatEventInternalService = Service.create(
  'chatEventInternal',
  () => new chatEventInternalServiceImpl()
).build();
