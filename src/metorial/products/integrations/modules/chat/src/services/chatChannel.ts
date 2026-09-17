import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { type ChannelType, type ChatAdapterInstance } from '@metorial-subspace/adapter-chat';
import {
  type Chat,
  type ChatAuthor,
  type ChatChannel,
  type ChatChannelType,
  type ChatInstanceProvider,
  type ChatWorkspace,
  db,
  type Environment,
  type Tenant
} from '@metorial-subspace/db';
import {
  checkTenant,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { chatAdapterService } from '../internal/chatAdapter';
import { chatChannelServiceInternal } from '../internal/chatChannel';
import { requireLocalChatEntity, withChatCapabilityFallback } from '../lib/chatCapability';
import { unwrapChatCall } from '../lib/chatError';

export type ChatWithProvider = Chat & {
  chatInstanceProvider: ChatInstanceProvider;
};

export type ChatChannelWithChat = ChatChannel & {
  chat: Chat;
  workspace: ChatWorkspace | null;
  recipient: ChatAuthor | null;
};

export type ListChatChannelsParams = {
  chat: ChatWithProvider;
  workspaceId?: string;
  type?: ChannelType;
  search?: string;
  hasAccess?: boolean;
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
    checkTenant(d, d.chat.chatInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatInstanceProvider: d.chat.chatInstanceProvider
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

    let resolveWorkspaceId = (async () => {
      if (!d.workspaceId) return d.workspaceId;

      let localWorkspace = await db.chatWorkspace.findFirst({
        where: {
          chatInstanceProviderOid: d.chat.chatInstanceProviderOid,
          OR: [{ id: d.workspaceId }, { workspaceId: d.workspaceId }]
        }
      });
      return localWorkspace?.workspaceId ?? d.workspaceId;
    })();

    return Paginator.create(({ externalCursor }) =>
      externalCursor(async page => {
        let listed = await d.client.call('metorial_chat$channel.list', {
          cursor: page.cursor,
          limit: page.limit,
          direction: page.direction,
          workspaceId: await resolveWorkspaceId,
          type: d.type,
          query: search
        });
        let listing = unwrapChatCall(listed, {
          code: 'chat_channel_list_failed',
          message: 'Failed to list channels from the chat provider.',
          invocation: {
            operation: 'channel.list',
            chatInstanceProvider: d.chat.chatInstanceProvider,
            chat: d.chat
          }
        });

        let upserted = await chatChannelServiceInternal.upsertChatChannels({
          chat: d.chat,
          channels: listing.channels
        });

        return {
          items: upserted.filter(channel => channel.hasAccess === (d.hasAccess ?? true)),
          nextCursor: listing.nextCursor,
          prevCursor: listing.prevCursor
        };
      })
    );
  }

  private async listChatChannelsFromDb(d: { tenant: Tenant } & ListChatChannelsParams) {
    let search = d.search?.trim() || undefined;
    let results = search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.chatChannel.id,
          query: search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let workspaceOid: bigint | undefined;
        if (d.workspaceId) {
          let workspace = await db.chatWorkspace.findFirst({
            where: {
              chatInstanceProviderOid: d.chat.chatInstanceProviderOid,
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
            hasAccess: d.hasAccess ?? true,
            ...(workspaceOid !== undefined ? { workspaceOid } : {}),
            ...(d.type ? { type: d.type as ChatChannelType } : {}),
            ...(results ? { id: { in: results.map(result => result.documentId) } } : {})
          },
          include: { chat: true, workspace: true, recipient: true }
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
    checkTenant(d, d.chat.chatInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatInstanceProvider: d.chat.chatInstanceProvider
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
      message: 'Failed to load the channel from the chat provider.',
      invocation: {
        operation: 'channel.get',
        chatInstanceProvider: d.chat.chatInstanceProvider,
        chat: d.chat
      }
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
      include: { chat: true, workspace: true, recipient: true }
    });

    return requireLocalChatEntity('chatChannel', d.channelId, local);
  }
}

export let chatChannelService = Service.create(
  'chatChannelService',
  () => new chatChannelServiceImpl()
).build();
