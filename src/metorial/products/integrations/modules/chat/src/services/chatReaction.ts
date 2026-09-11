import { Service } from '@lowerdeck/service';
import {
  type ChatAdapterInstance,
  type EmojiInput,
  type ReactionCount
} from '@metorial-subspace/adapter-chat';
import { db, type Environment, type Tenant } from '@metorial-subspace/db';
import {
  checkTenant,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { chatAdapterService } from '../internal/chatAdapter';
import { assertChatCapability, withChatCapabilityFallback } from '../lib/chatCapability';
import { unwrapChatCall } from '../lib/chatError';
import { type ChatWithProvider } from './chatChannel';

export type ChatReactionTargetParams = {
  chat: ChatWithProvider;
  channelId: string;
  messageId: string;
};

export type AddChatReactionParams = ChatReactionTargetParams & { emoji: EmojiInput };
export type RemoveChatReactionParams = ChatReactionTargetParams & { emoji: EmojiInput };
export type ListChatReactionsParams = ChatReactionTargetParams;

let assertReactionAddCapability = (client: ChatAdapterInstance) =>
  assertChatCapability(client, 'message_reaction_add', {
    message: 'This chat provider does not support adding reactions.'
  });

let assertReactionRemoveCapability = (client: ChatAdapterInstance) =>
  assertChatCapability(client, 'message_reaction_remove', {
    message: 'This chat provider does not support removing reactions.'
  });

class chatReactionServiceImpl {
  async addChatReaction(d: MetorialFacing<AddChatReactionParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.addChatReactionInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async addChatReactionInternal(
    d: { tenant: Tenant; environment: Environment } & AddChatReactionParams
  ) {
    checkTenant(d, d.chat.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });

    assertReactionAddCapability(client);

    let { channelId, messageId } = await this.resolveTarget(d);

    let added = await client.call('metorial_chat$reaction.add', {
      channelId,
      messageId,
      emoji: d.emoji
    });

    return unwrapChatCall(added, {
      code: 'chat_reaction_add_failed',
      message: 'Failed to add the reaction with the chat provider.'
    });
  }

  async removeChatReaction(d: MetorialFacing<RemoveChatReactionParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.removeChatReactionInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async removeChatReactionInternal(
    d: { tenant: Tenant; environment: Environment } & RemoveChatReactionParams
  ) {
    checkTenant(d, d.chat.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });

    assertReactionRemoveCapability(client);

    let { channelId, messageId } = await this.resolveTarget(d);

    let removed = await client.call('metorial_chat$reaction.remove', {
      channelId,
      messageId,
      emoji: d.emoji
    });

    return unwrapChatCall(removed, {
      code: 'chat_reaction_remove_failed',
      message: 'Failed to remove the reaction with the chat provider.'
    });
  }

  async listChatReactions(d: MetorialFacing<ListChatReactionsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.listChatReactionsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listChatReactionsInternal(
    d: { tenant: Tenant; environment: Environment } & ListChatReactionsParams
  ) {
    checkTenant(d, d.chat.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });

    return withChatCapabilityFallback(client, 'message_reaction_list', {
      provider: () => this.listChatReactionsFromProvider({ ...d, client }),
      fallback: () => this.listChatReactionsFromDb(d)
    });
  }

  private async resolveTarget(d: ChatReactionTargetParams) {
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

    return { localChannel, localMessage, channelId, messageId };
  }

  private async listChatReactionsFromProvider(
    d: ListChatReactionsParams & { client: ChatAdapterInstance }
  ) {
    let { localMessage, channelId, messageId } = await this.resolveTarget(d);

    let listed = await d.client.call('metorial_chat$reaction.list', { channelId, messageId });
    let result = unwrapChatCall(listed, {
      code: 'chat_reaction_list_failed',
      message: 'Failed to list reactions from the chat provider.'
    });

    if (localMessage) {
      await db.chatMessage.update({
        where: { oid: localMessage.oid },
        data: { reactions: result.reactions as any }
      });
    }

    return { reactions: result.reactions };
  }

  private async listChatReactionsFromDb(
    d: ListChatReactionsParams
  ): Promise<{ reactions: ReactionCount[] }> {
    let localChannel = await db.chatChannel.findFirst({
      where: {
        chatOid: d.chat.oid,
        OR: [{ id: d.channelId }, { channelId: d.channelId }]
      }
    });
    if (!localChannel) return { reactions: [] };

    let localMessage = await db.chatMessage.findFirst({
      where: {
        channelOid: localChannel.oid,
        OR: [{ id: d.messageId }, { messageId: d.messageId }]
      }
    });

    return { reactions: (localMessage?.reactions as ReactionCount[] | null) ?? [] };
  }
}

export let chatReactionService = Service.create(
  'chatReactionService',
  () => new chatReactionServiceImpl()
).build();
