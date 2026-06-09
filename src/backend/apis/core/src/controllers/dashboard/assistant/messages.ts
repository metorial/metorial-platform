import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { assistantMessageService, assistantRequestService } from '@metorial/module-assistant';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { assistantMessagePresenter } from '../../../presenters';
import {
  assistantConversationGroup,
  assistantMessageGroup,
  requireAssistantActor
} from './context';

let assistantMessagePartSchema = v.union([
  v.object({
    type: v.literal('text'),
    text: v.string()
  }),
  v.object({
    type: v.literal('file'),
    data: v.string(),
    encoding: v.enumOf(['utf-8', 'base64']),
    media_type: v.string(),
    filename: v.optional(v.string())
  })
]);

export let assistantMessageHandlers = {
  listMessages: assistantConversationGroup
    .get(
      instancePath(
        'conversations/:assistantConversationId/messages',
        'conversations.messages.list'
      ),
      {
        name: 'List assistant messages',
        description: 'List messages in a specific assistant conversation.'
      }
    )
    .use(
      checkAccess({
        possibleScopes: [
          'instance.assistant.conversation:read',
          'consumer#instance.assistant.conversation:read'
        ]
      })
    )
    .use(requireConsumerTokenForPublishableKey())
    .query('default', Paginator.validate(v.object({})))
    .outputList(assistantMessagePresenter)
    .do(async ctx => {
      let paginator = await assistantMessageService.list({
        organization: ctx.organization,
        instance: ctx.instance,
        ...requireAssistantActor(ctx),
        conversationId: ctx.assistantConversation.id
      });
      let list = await paginator.run(ctx.query);

      return Paginator.present(list, assistantConversationItem =>
        assistantMessagePresenter.present({ assistantConversationItem })
      );
    }),

  createMessage: assistantConversationGroup
    .post(
      instancePath(
        'conversations/:assistantConversationId/messages',
        'conversations.messages.create'
      ),
      {
        name: 'Create assistant message',
        description: 'Create a user message and assistant request in a specific conversation.'
      }
    )
    .use(
      checkAccess({
        possibleScopes: [
          'instance.assistant.conversation:write',
          'consumer#instance.assistant.conversation:write'
        ]
      })
    )
    .use(requireConsumerTokenForPublishableKey())
    .body(
      'default',
      v.object({
        message: v.object({
          parts: v.array(assistantMessagePartSchema)
        }),
        parent_message_id: v.optional(v.string()),
        model_id: v.optional(v.string())
      })
    )
    .output(assistantMessagePresenter)
    .do(async ctx => {
      let { item } = await assistantRequestService.create({
        organization: ctx.organization,
        instance: ctx.instance,
        ...requireAssistantActor(ctx),
        conversationId: ctx.assistantConversation.id,
        message: {
          parts: ctx.body.message.parts.map(part =>
            part.type == 'text'
              ? {
                  type: 'text' as const,
                  text: part.text
                }
              : {
                  type: 'file' as const,
                  filename: part.filename,
                  mediaType: part.media_type,
                  data: part.data,
                  encoding: part.encoding
                }
          )
        },
        parentMessageId: ctx.body.parent_message_id,
        modelId: ctx.body.model_id
      });

      return assistantMessagePresenter.present({
        assistantConversationItem: item
      });
    }),

  getMessage: assistantMessageGroup
    .get(
      instancePath(
        'conversations/:assistantConversationId/messages/:assistantMessageId',
        'conversations.messages.get'
      ),
      {
        name: 'Get assistant message',
        description: 'Get a specific assistant message.'
      }
    )
    .use(
      checkAccess({
        possibleScopes: [
          'instance.assistant.conversation:read',
          'consumer#instance.assistant.conversation:read'
        ]
      })
    )
    .use(requireConsumerTokenForPublishableKey())
    .output(assistantMessagePresenter)
    .do(async ctx =>
      assistantMessagePresenter.present({
        assistantConversationItem: ctx.assistantConversationItem
      })
    )
};
