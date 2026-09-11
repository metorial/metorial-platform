import { Service } from '@lowerdeck/service';
import { type ChatAdapterInstance } from '@metorial-subspace/adapter-chat';
import {
  type ChatChannel,
  type ChatThread,
  type Environment,
  type Tenant
} from '@metorial-subspace/db';
import {
  checkTenant,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { chatAdapterService } from '../internal/chatAdapter';
import { assertChatCapability } from '../lib/chatCapability';
import { unwrapChatCall } from '../lib/chatError';
import { type ChatWithProvider } from './chatChannel';

export type StartTypingInput = {
  status?: string;
};

export type StartTypingParams = {
  chat: ChatWithProvider;
  channel: ChatChannel;
  thread?: ChatThread | null;
  input?: StartTypingInput;
};

let assertTypingCapability = (client: ChatAdapterInstance) =>
  assertChatCapability(client, 'typing', {
    message: 'This chat provider does not support showing typing indicators.'
  });

let assertTypingThreadCapability = (client: ChatAdapterInstance, hasThread: boolean) => {
  if (hasThread) return;

  assertChatCapability(client, 'typing_without_thread', {
    code: 'chat_typing_thread_required',
    message: 'This chat provider requires a thread to show a typing indicator.'
  });
};

class chatTypingServiceImpl {
  async startTyping(d: MetorialFacing<StartTypingParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.startTypingInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async startTypingInternal(
    d: { tenant: Tenant; environment: Environment } & StartTypingParams
  ) {
    checkTenant(d, d.chat.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chat.chatIntegrationInstanceProvider
    });

    assertTypingCapability(client);
    assertTypingThreadCapability(client, !!d.thread);

    let started = await client.call('metorial_chat$typing.start', {
      channelId: d.channel.channelId,
      threadId: d.thread?.threadId,
      status: d.input?.status
    });

    return unwrapChatCall(started, {
      code: 'chat_typing_start_failed',
      message: 'Failed to show the typing indicator with the chat provider.'
    });
  }
}

export let chatTypingService = Service.create(
  'chatTypingService',
  () => new chatTypingServiceImpl()
).build();
