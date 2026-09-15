import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  chatChannelMemberService,
  chatChannelService,
  chatThreadService,
  chatTypingService
} from '@metorial-subspace/module-chat';
import {
  chatAuthorPresenter,
  chatChannelPresenter,
  chatTypingIndicatorPresenter
} from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { chatGroup } from './_shared';

let channelTypeValidator = v.enumOf([
  'public',
  'private',
  'dm',
  'group_dm',
  'shared',
  'announcement',
  'forum',
  'unknown'
]);

let chatChannelGroup = chatGroup.use(async ctx => {
  if (!ctx.params.channelId) {
    throw new ServiceError(
      badRequestError({
        message: 'channelId is required',
        description: 'The channelId path parameter is required.'
      })
    );
  }

  let chatChannel = await chatChannelService.getChatChannel({
    instance: ctx.instance,
    chat: ctx.chat,
    channelId: ctx.params.channelId
  });

  return { chatChannel };
});

export let chatChannelController = Controller.create(
  {
    name: 'Chat Channels',
    description:
      'Chat channels are the conversations within a chat, such as Slack channels or Microsoft Teams channels.'
  },
  {
    list: chatGroup
      .get(instancePath('chats/:chatId/channels', 'chats.channels.list'), {
        name: 'List chat channels',
        description: 'Returns a paginated list of channels for a chat.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .outputList(chatChannelPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            workspace_id: v.optional(
              v.string({ description: 'Filter to channels in this workspace' })
            ),
            type: v.optional(channelTypeValidator, { description: 'Filter by channel type' }),
            search: v.optional(v.string({ description: 'Search by channel name or topic' }))
          })
        )
      )
      .do(async ctx => {
        let paginator = await chatChannelService.listChatChannels({
          instance: ctx.instance,
          chat: ctx.chat,
          workspaceId: ctx.query.workspace_id,
          type: ctx.query.type,
          search: ctx.query.search
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, chatChannel =>
          chatChannelPresenter.present({ chatChannel })
        );
      }),

    get: chatChannelGroup
      .get(instancePath('chats/:chatId/channels/:channelId', 'chats.channels.get'), {
        name: 'Get chat channel',
        description: 'Retrieves a specific chat channel.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .output(chatChannelPresenter)
      .do(async ctx => chatChannelPresenter.present({ chatChannel: ctx.chatChannel })),

    listMembers: chatChannelGroup
      .get(
        instancePath(
          'chats/:chatId/channels/:channelId/members',
          'chats.channels.members.list'
        ),
        {
          name: 'List chat channel members',
          description: 'Returns a paginated list of members of a chat channel.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .outputList(chatAuthorPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await chatChannelMemberService.listChatChannelMembers({
          instance: ctx.instance,
          chat: ctx.chat,
          channelId: ctx.chatChannel.id
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, chatAuthor =>
          chatAuthorPresenter.present({ chatAuthor })
        );
      }),

    getMember: chatChannelGroup
      .get(
        instancePath(
          'chats/:chatId/channels/:channelId/members/:userId',
          'chats.channels.members.get'
        ),
        {
          name: 'Get chat channel member',
          description: 'Retrieves a specific member of a chat channel.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .output(chatAuthorPresenter)
      .do(async ctx => {
        if (!ctx.params.userId) {
          throw new ServiceError(
            badRequestError({
              message: 'userId is required',
              description: 'The userId path parameter is required.'
            })
          );
        }

        let chatAuthor = await chatChannelMemberService.getChatChannelMember({
          instance: ctx.instance,
          chat: ctx.chat,
          channelId: ctx.chatChannel.id,
          userId: ctx.params.userId
        });

        return chatAuthorPresenter.present({ chatAuthor });
      }),

    typing: chatChannelGroup
      .post(
        instancePath(
          'chats/:chatId/channels/:channelId/typing',
          'chats.channels.typing.start'
        ),
        {
          name: 'Start chat typing indicator',
          description: 'Shows a typing indicator in a chat channel.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.chat:write'] }))
      .body(
        'default',
        v.object({
          thread_id: v.optional(
            v.string({ description: 'Show the typing indicator within this thread' })
          ),
          status: v.optional(v.string({ description: 'Provider-specific typing status text' }))
        })
      )
      .output(chatTypingIndicatorPresenter)
      .do(async ctx => {
        let thread = ctx.body.thread_id
          ? await chatThreadService.getChatThread({
              instance: ctx.instance,
              chat: ctx.chat,
              channelId: ctx.chatChannel.id,
              threadId: ctx.body.thread_id
            })
          : null;

        await chatTypingService.startTyping({
          instance: ctx.instance,
          chat: ctx.chat,
          channel: ctx.chatChannel,
          thread,
          input: { status: ctx.body.status }
        });

        return chatTypingIndicatorPresenter.present({ started: true });
      })
  }
);
