import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { chatInstanceProviderService, chatService } from '@metorial-subspace/module-chat';
import { instanceGroup } from '../../../middleware/instanceGroup';

export let chatGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.chatId) {
    throw new ServiceError(
      badRequestError({
        message: 'chatId is required',
        description: 'The chatId path parameter is required.'
      })
    );
  }

  let chat = await chatService.getChatById({
    instance: ctx.instance,
    chatId: ctx.params.chatId
  });

  return { chat };
});

export let resolveSoleChatInstanceProvider = async (
  instance: Parameters<typeof chatInstanceProviderService.listChatInstanceProviders>[0]['instance'],
  chatInstanceId: string
) => {
  let paginator = await chatInstanceProviderService.listChatInstanceProviders({
    instance,
    chatInstanceIds: [chatInstanceId]
  });
  let list = await paginator.run({});
  let chatInstanceProvider = list.items[0];

  if (!chatInstanceProvider) {
    throw new ServiceError(notFoundError('chat.instance.provider', chatInstanceId));
  }

  return chatInstanceProvider;
};
