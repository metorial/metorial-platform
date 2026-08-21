import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { type ChannelType, type ChatAdapterInstance } from '@metorial-subspace/adapter-chat';
import {
  type Chat,
  type ChatChannel,
  type ChatChannelType,
  type ChatIntegrationInstanceProvider,
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
import { requireLocalChatEntity, withChatCapabilityFallback } from '../lib/chatCapability';
import { unwrapChatCall } from '../lib/chatError';

export type ChatWithProvider = Chat & {
  chatIntegrationInstanceProvider: ChatIntegrationInstanceProvider;
};

export type ChatChannelWithChat = ChatChannel & { chat: Chat };

export type ListChatChannelsParams = {
  chat: ChatWithProvider;
  workspaceId?: string;
  type?: ChannelType;
  search?: string;
};

export type GetChatChannelParams = {
  chat: ChatWithProvider;
  channelId: string;
};

class chatChannelServiceImpl {
  async listChatChannels(d: MetorialFacing<ListChatChannelsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.listChatChannelsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listChatChannelsInternal(
    d: { tenant: Tenant; environment: Environment } & ListChatChannelsParams
  ) {
    checkTenant(d, d.chat.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });

    return withChatCapabilityFallback(client, 'channel_read', {
      provider: () => this.listChatChannelsFromProvider({ ...d, client }),
      fallback: () => this.listChatChannelsFromDb(d)
    });
  }

  private listChatChannelsFromProvider(
    d: ListChatChannelsParams & { client: ChatAdapterInstance }
  ) {
    let search = d.search?.trim() || undefined;

    return Paginator.create(({ externalCursor }) =>
      externalCursor(async page => {
        let listed = await d.client.call('metorial_chat$channel.list', {
          cursor: page.cursor,
          limit: page.limit,
          direction: page.direction,
          workspaceId: d.workspaceId,
          type: d.type,
          query: search
        });
        let listing = unwrapChatCall(listed, {
          code: 'chat_channel_list_failed',
          message: 'Failed to list channels from the chat provider.'
        });

        let upserted = await chatChannelServiceInternal.upsertChatChannels({
          chat: d.chat,
          channels: listing.channels
        });

        return {
          items: upserted,
          nextCursor: listing.nextCursor,
          prevCursor: listing.prevCursor
        };
      })
    );
  }

  private listChatChannelsFromDb(d: ListChatChannelsParams) {
    let search = d.search?.trim() || undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let workspaceOid: bigint | undefined;
        if (d.workspaceId) {
          let workspace = await db.chatWorkspace.findFirst({
            where: {
              chatIntegrationInstanceProviderOid: d.chat.chatIntegrationInstanceProviderOid,
              OR: [{ id: d.workspaceId }, { workspaceId: d.workspaceId }]
            }
          });
          // No local match for the requested workspace -- there can be no channels for it.
          if (!workspace) return [];
          workspaceOid = workspace.oid;
        }

        return db.chatChannel.findMany({
          ...opts,
          where: {
            chatOid: d.chat.oid,
            ...(workspaceOid !== undefined ? { workspaceOid } : {}),
            ...(d.type ? { type: d.type as ChatChannelType } : {}),
            ...(search
              ? {
                  OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { topic: { contains: search, mode: 'insensitive' as const } },
                    { subject: { contains: search, mode: 'insensitive' as const } }
                  ]
                }
              : {})
          },
          include: { chat: true }
        });
      })
    );
  }

  async getChatChannel(d: MetorialFacing<GetChatChannelParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.getChatChannelInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getChatChannelInternal(
    d: { tenant: Tenant; environment: Environment } & GetChatChannelParams
  ) {
    checkTenant(d, d.chat.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });

    return withChatCapabilityFallback(client, 'channel_read', {
      provider: () => this.getChatChannelFromProvider({ ...d, client }),
      fallback: () => this.getChatChannelFromDb(d)
    });
  }

  private async getChatChannelFromProvider(
    d: GetChatChannelParams & { client: ChatAdapterInstance }
  ) {
    let local = await db.chatChannel.findFirst({
      where: {
        chatOid: d.chat.oid,
        OR: [{ id: d.channelId }, { channelId: d.channelId }]
      }
    });
    let channelId = local?.channelId ?? d.channelId;

    let got = await d.client.call('metorial_chat$channel.get', { channelId });
    let channel = unwrapChatCall(got, {
      code: 'chat_channel_get_failed',
      message: 'Failed to load the channel from the chat provider.'
    });

    let [upserted] = await chatChannelServiceInternal.upsertChatChannels({
      chat: d.chat,
      channels: [channel.channel]
    });

    return upserted!;
  }

  private async getChatChannelFromDb(d: GetChatChannelParams) {
    let local = await db.chatChannel.findFirst({
      where: {
        chatOid: d.chat.oid,
        OR: [{ id: d.channelId }, { channelId: d.channelId }]
      },
      include: { chat: true }
    });

    return requireLocalChatEntity('chatChannel', d.channelId, local);
  }
}

export let chatChannelService = Service.create(
  'chatChannelService',
  () => new chatChannelServiceImpl()
).build();
