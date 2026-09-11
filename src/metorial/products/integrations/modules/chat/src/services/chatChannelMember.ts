import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Tenant } from '@metorial-subspace/db';
import {
  checkTenant,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { chatAdapterService } from '../internal/chatAdapter';
import { chatAuthorServiceInternal } from '../internal/chatAuthor';
import { assertChatCapability } from '../lib/chatCapability';
import { unwrapChatCall } from '../lib/chatError';
import { type ChatWithProvider } from './chatChannel';

export type ListChatChannelMembersParams = {
  chat: ChatWithProvider;
  channelId: string;
};

export type GetChatChannelMemberParams = {
  chat: ChatWithProvider;
  channelId: string;
  userId: string;
};

class chatChannelMemberServiceImpl {
  async listChatChannelMembers(d: MetorialFacing<ListChatChannelMembersParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.listChatChannelMembersInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listChatChannelMembersInternal(
    d: { tenant: Tenant; environment: Environment } & ListChatChannelMembersParams
  ) {
    checkTenant(d, d.chat.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });

    assertChatCapability(client, 'channel_members_read', {
      message: 'This chat provider does not support listing channel members.'
    });

    let localChannel = await db.chatChannel.findFirst({
      where: {
        chatOid: d.chat.oid,
        OR: [{ id: d.channelId }, { channelId: d.channelId }]
      }
    });
    let channelId = localChannel?.channelId ?? d.channelId;

    return Paginator.create(({ externalCursor }) =>
      externalCursor(async page => {
        let listed = await client.call('metorial_chat$channel.members', {
          cursor: page.cursor,
          limit: page.limit,
          direction: page.direction,
          channelId
        });
        let listing = unwrapChatCall(listed, {
          code: 'chat_channel_members_list_failed',
          message: 'Failed to list channel members from the chat provider.'
        });

        let upserted = await chatAuthorServiceInternal.upsertChatAuthors({
          chat: d.chat,
          authors: listing.authors
        });

        return {
          items: upserted,
          nextCursor: listing.nextCursor,
          prevCursor: listing.prevCursor
        };
      })
    );
  }

  async getChatChannelMember(d: MetorialFacing<GetChatChannelMemberParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.getChatChannelMemberInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getChatChannelMemberInternal(
    d: { tenant: Tenant; environment: Environment } & GetChatChannelMemberParams
  ) {
    checkTenant(d, d.chat.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });

    assertChatCapability(client, 'user_read', {
      message: 'This chat provider does not support looking up users.'
    });

    let got = await client.call('metorial_chat$user.get', { userId: d.userId });
    let result = unwrapChatCall(got, {
      code: 'chat_channel_member_get_failed',
      message: 'Failed to load the channel member from the chat provider.'
    });

    let [upserted] = await chatAuthorServiceInternal.upsertChatAuthors({
      chat: d.chat,
      authors: [result.author]
    });

    return upserted!;
  }
}

export let chatChannelMemberService = Service.create(
  'chatChannelMemberService',
  () => new chatChannelMemberServiceImpl()
).build();
