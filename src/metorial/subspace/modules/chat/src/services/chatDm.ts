import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { type ChatAdapterInstance } from '@metorial-subspace/adapter-chat';
import { type Environment, type Tenant } from '@metorial-subspace/db';
import {
  checkTenant,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { chatAdapterService } from '../internal/chatAdapter';
import { chatChannelServiceInternal } from '../internal/chatChannel';
import { unwrapChatCall } from '../lib/chatError';
import { type ChatWithProvider } from './chatChannel';

export type OpenSingleDmUserInput =
  | { type: 'email'; email: string }
  | { type: 'phone_number'; phoneNumber: string }
  | { type: 'generic'; userId: string };

export type OpenGroupDmUserInput =
  | { type: 'email'; emails: string[] }
  | { type: 'phone_number'; phoneNumbers: string[] }
  | { type: 'generic'; userIds: string[] };

export type OpenSingleDmParams = {
  chat: ChatWithProvider;
  input: OpenSingleDmUserInput;
};

export type OpenGroupDmParams = {
  chat: ChatWithProvider;
  input: OpenGroupDmUserInput;
};

let assertDmCapability = (
  client: ChatAdapterInstance,
  capability: 'dm_open_single' | 'dm_open_group'
) => {
  if (client.isCapabilityAvailable(capability)) return;

  throw new ServiceError(
    badRequestError({
      code: `chat_${capability}_not_supported`,
      message: 'This chat provider does not support opening direct messages.'
    })
  );
};

let assertUserIdKindCapability = (
  client: ChatAdapterInstance,
  type: 'email' | 'phone_number'
) => {
  let capability: 'user_id_is_email' | 'user_id_is_phone_number' =
    type === 'email' ? 'user_id_is_email' : 'user_id_is_phone_number';
  if (client.isCapabilityAvailable(capability)) return;

  throw new ServiceError(
    badRequestError({
      code: `chat_dm_${type}_not_supported`,
      message:
        type === 'email'
          ? 'This chat provider does not support opening direct messages by email address.'
          : 'This chat provider does not support opening direct messages by phone number.'
    })
  );
};

let resolveSingleUserId = (
  client: ChatAdapterInstance,
  input: OpenSingleDmUserInput
): string => {
  switch (input.type) {
    case 'email':
      assertUserIdKindCapability(client, 'email');
      return input.email;
    case 'phone_number':
      assertUserIdKindCapability(client, 'phone_number');
      return input.phoneNumber;
    case 'generic':
      return input.userId;
  }
};

let resolveGroupUserIds = (
  client: ChatAdapterInstance,
  input: OpenGroupDmUserInput
): string[] => {
  switch (input.type) {
    case 'email':
      assertUserIdKindCapability(client, 'email');
      return input.emails;
    case 'phone_number':
      assertUserIdKindCapability(client, 'phone_number');
      return input.phoneNumbers;
    case 'generic':
      return input.userIds;
  }
};

class chatDmServiceImpl {
  async openSingleDm(d: MetorialFacing<OpenSingleDmParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.openSingleDmInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async openSingleDmInternal(
    d: { tenant: Tenant; environment: Environment } & OpenSingleDmParams
  ) {
    checkTenant(d, d.chat.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });

    assertDmCapability(client, 'dm_open_single');
    let userId = resolveSingleUserId(client, d.input);

    let opened = await client.call('metorial_chat$dm.openSingle', { userId });
    let result = unwrapChatCall(opened, {
      code: 'chat_dm_open_single_failed',
      message: 'Failed to open the direct message with the chat provider.'
    });

    let [channel] = await chatChannelServiceInternal.upsertChatChannels({
      chat: d.chat,
      channels: [result.channel]
    });

    return channel!;
  }

  async openGroupDm(d: MetorialFacing<OpenGroupDmParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.openGroupDmInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async openGroupDmInternal(
    d: { tenant: Tenant; environment: Environment } & OpenGroupDmParams
  ) {
    checkTenant(d, d.chat.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });

    assertDmCapability(client, 'dm_open_group');
    let userIds = resolveGroupUserIds(client, d.input);

    let opened = await client.call('metorial_chat$dm.openGroup', { userIds });
    let result = unwrapChatCall(opened, {
      code: 'chat_dm_open_group_failed',
      message: 'Failed to open the group direct message with the chat provider.'
    });

    let [channel] = await chatChannelServiceInternal.upsertChatChannels({
      chat: d.chat,
      channels: [result.channel]
    });

    return channel!;
  }
}

export let chatDmService = Service.create(
  'chatDmService',
  () => new chatDmServiceImpl()
).build();
