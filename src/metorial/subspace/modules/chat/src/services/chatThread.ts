import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { type ChatAdapterInstance, type ThreadType } from '@metorial-subspace/adapter-chat';
import {
  type Chat,
  type ChatThread,
  type ChatThreadType,
  db,
  type Environment,
  type Tenant
} from '@metorial-subspace/db';
import {
  checkTenant,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { chatAdapterService } from '../internal/chatAdapter';
import { chatChannelServiceInternal } from '../internal/chatChannel';
import { chatThreadServiceInternal } from '../internal/chatThread';
import { requireLocalChatEntity, withChatCapabilityFallback } from '../lib/chatCapability';
import { unwrapChatCall } from '../lib/chatError';
import { type ChatWithProvider } from './chatChannel';

export type ChatThreadWithChat = ChatThread & { chat: Chat };

export type ListChatThreadsParams = {
  chat: ChatWithProvider;
  channelId: string;
  type?: ThreadType;
};

export type GetChatThreadParams = {
  chat: ChatWithProvider;
  channelId: string;
  threadId: string;
};

class chatThreadServiceImpl {
  async listChatThreads(d: MetorialFacing<ListChatThreadsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.listChatThreadsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listChatThreadsInternal(
    d: { tenant: Tenant; environment: Environment } & ListChatThreadsParams
  ) {
    checkTenant(d, d.chat.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });

    return withChatCapabilityFallback(client, 'thread_read', {
      provider: () => this.listChatThreadsFromProvider({ ...d, client }),
      fallback: () => this.listChatThreadsFromDb(d)
    });
  }

  private async listChatThreadsFromProvider(
    d: ListChatThreadsParams & { client: ChatAdapterInstance }
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
        let listed = await d.client.call('metorial_chat$thread.list', {
          cursor: page.cursor,
          limit: page.limit,
          direction: page.direction,
          channelId,
          type: d.type
        });
        let listing = unwrapChatCall(listed, {
          code: 'chat_thread_list_failed',
          message: 'Failed to list threads from the chat provider.'
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

        let upserted = await chatThreadServiceInternal.upsertChatThreads({
          chat: d.chat,
          channel,
          threads: listing.threads
        });

        return {
          items: upserted,
          nextCursor: listing.nextCursor,
          prevCursor: listing.prevCursor
        };
      })
    );
  }

  private async listChatThreadsFromDb(d: ListChatThreadsParams) {
    let localChannel = await db.chatChannel.findFirst({
      where: {
        chatOid: d.chat.oid,
        OR: [{ id: d.channelId }, { channelId: d.channelId }]
      }
    });

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        if (!localChannel) return [];

        return db.chatThread.findMany({
          ...opts,
          where: {
            channelOid: localChannel.oid,
            ...(d.type ? { type: d.type as ChatThreadType } : {})
          },
          include: { chat: true }
        });
      })
    );
  }

  async getChatThread(d: MetorialFacing<GetChatThreadParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.getChatThreadInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getChatThreadInternal(
    d: { tenant: Tenant; environment: Environment } & GetChatThreadParams
  ) {
    checkTenant(d, d.chat.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });

    return withChatCapabilityFallback(client, 'thread_read', {
      provider: () => this.getChatThreadFromProvider({ ...d, client }),
      fallback: () => this.getChatThreadFromDb(d)
    });
  }

  private async getChatThreadFromProvider(
    d: GetChatThreadParams & { client: ChatAdapterInstance }
  ) {
    let localChannel = await db.chatChannel.findFirst({
      where: {
        chatOid: d.chat.oid,
        OR: [{ id: d.channelId }, { channelId: d.channelId }]
      }
    });
    let channelId = localChannel?.channelId ?? d.channelId;

    let localThread = localChannel
      ? await db.chatThread.findFirst({
          where: {
            channelOid: localChannel.oid,
            OR: [{ id: d.threadId }, { threadId: d.threadId }]
          }
        })
      : null;
    let threadId = localThread?.threadId ?? d.threadId;

    let got = await d.client.call('metorial_chat$thread.get', { channelId, threadId });
    let result = unwrapChatCall(got, {
      code: 'chat_thread_get_failed',
      message: 'Failed to load the thread from the chat provider.'
    });

    let channel = result.channel
      ? (
          await chatChannelServiceInternal.upsertChatChannels({
            chat: d.chat,
            channels: [result.channel]
          })
        )[0]
      : localChannel;
    if (!channel) throw new ServiceError(notFoundError('chatChannel', channelId));

    let [upserted] = await chatThreadServiceInternal.upsertChatThreads({
      chat: d.chat,
      channel,
      threads: [result.thread]
    });

    return upserted!;
  }

  private async getChatThreadFromDb(d: GetChatThreadParams) {
    let localChannel = await db.chatChannel.findFirst({
      where: {
        chatOid: d.chat.oid,
        OR: [{ id: d.channelId }, { channelId: d.channelId }]
      }
    });
    if (!localChannel) throw new ServiceError(notFoundError('chatThread', d.threadId));

    let local = await db.chatThread.findFirst({
      where: {
        channelOid: localChannel.oid,
        OR: [{ id: d.threadId }, { threadId: d.threadId }]
      },
      include: { chat: true }
    });

    return requireLocalChatEntity('chatThread', d.threadId, local);
  }
}

export let chatThreadService = Service.create(
  'chatThreadService',
  () => new chatThreadServiceImpl()
).build();
