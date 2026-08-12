import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  productAssistantMessageService,
  productAssistantRequestService
} from '@metorial/module-product-assistant';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { assistantMessagePresenter } from '@metorial/presenters';
import {
  assistantConversationGroup,
  assistantMessageGroup,
  getAssistantScope
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
      let paginator = await productAssistantMessageService.listAssistantMessages({
        ...getAssistantScope(ctx),
        conversation: ctx.assistantConversation
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
      let { item } = await productAssistantRequestService.createAssistantRequest({
        ...getAssistantScope(ctx),
        conversation: ctx.assistantConversation,
        input: {
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
        }
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
    ),

  respondToHandoffs: assistantMessageGroup
    .post(
      instancePath(
        'conversations/:assistantConversationId/messages/:assistantMessageId/handoff-responses',
        'conversations.messages.handoff_responses'
      ),
      {
        name: 'Respond to assistant handoffs',
        description: 'Submit one or more client handoff tool responses for a waiting message.'
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
        responses: v.array(
          v.object({
            tool_call_id: v.string(),
            output: v.any()
          })
        )
      })
    )
    .output(assistantMessagePresenter)
    .do(async ctx => {
      let item = await productAssistantRequestService.respondToAssistantHandoffs({
        ...getAssistantScope(ctx),
        conversation: ctx.assistantConversation,
        input: {
          messageId: ctx.assistantConversationItem.message.id,
          responses: ctx.body.responses.map(response => ({
            toolCallId: response.tool_call_id,
            output: response.output
          }))
        }
      });

      return assistantMessagePresenter.present({
        assistantConversationItem: item
      });
    })
};
