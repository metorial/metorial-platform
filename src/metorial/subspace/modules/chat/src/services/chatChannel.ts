import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { type ChannelType } from '@metorial-subspace/adapter-chat';
import {
  type Chat,
  type ChatChannel,
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

    if (!client.isCapabilityAvailable('channel_read')) {
      return Paginator.create(() => async () => ({
        items: [] as ChatChannelWithChat[],
        pagination: { hasNextPage: false, hasPreviousPage: false }
      }));
    }

    let search = d.search?.trim() || undefined;

    return Paginator.create(({ externalCursor }) =>
      externalCursor(async page => {
        let listed = await client.call('metorial_chat$channel.list', {
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

    if (!client.isCapabilityAvailable('channel_read')) {
      throw new ServiceError(notFoundError('chatChannel', d.channelId));
    }

    let local = await db.chatChannel.findFirst({
      where: {
        chatOid: d.chat.oid,
        OR: [{ id: d.channelId }, { channelId: d.channelId }]
      }
    });
    let channelId = local?.channelId ?? d.channelId;

    let got = await client.call('metorial_chat$channel.get', { channelId });
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
}

export let chatChannelService = Service.create(
  'chatChannelService',
  () => new chatChannelServiceImpl()
).build();
