import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { Consumer, OrganizationActor } from '@metorial/db';
import {
  assistantConversationService,
  assistantMessageService,
  assistantRequestService,
  assistantService
} from '@metorial/module-assistant';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { requireParam } from '../../lib/requireParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../middleware/requireConsumerTokenForPublishableKey';
import {
  assistantConversationPresenter,
  assistantMessagePresenter,
  assistantPresenter
} from '../../presenters';

let getAssistantActorContext = (ctx: {
  actor?: OrganizationActor;
  consumerProfile?: {
    consumer: Consumer;
  };
}) => {
  if (ctx.consumerProfile?.consumer) {
    return {
      consumer: ctx.consumerProfile.consumer
    } as const;
  }

  if (ctx.actor) {
    return {
      actor: ctx.actor
    } as const;
  }

  throw new ServiceError(
    forbiddenError({
      message: 'Assistant actor context is required',
      description:
        'Assistant endpoints require an authenticated organization actor or consumer.'
    })
  );
};

let requireAssistantActor = (ctx: {
  actor?: OrganizationActor;
  consumerProfile?: { consumer: Consumer };
}) => getAssistantActorContext(ctx);

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

let assistantConversationGroup = instanceGroup.use(async ctx => {
  let assistantConversationId = requireParam(ctx.params, 'assistantConversationId');

  let assistantConversation = await assistantConversationService.get({
    organization: ctx.organization,
    instance: ctx.instance,
    ...requireAssistantActor(ctx),
    conversationId: assistantConversationId
  });

  return { assistantConversation };
});

let assistantMessageGroup = assistantConversationGroup.use(async ctx => {
  let assistantMessageId = requireParam(ctx.params, 'assistantMessageId');

  let assistantConversationItem = await assistantMessageService.get({
    organization: ctx.organization,
    instance: ctx.instance,
    ...requireAssistantActor(ctx),
    conversationId: ctx.assistantConversation.id,
    messageId: assistantMessageId
  });

  return { assistantConversationItem };
});

export let dashboardAssistantController = Controller.create(
  {
    name: 'Assistants',
    description: 'Assistant and conversation endpoints'
  },
  {
    listAssistants: instanceGroup
      .get(instancePath('assistants', 'assistants.list'), {
        name: 'List assistants',
        description: 'List assistants available in an instance.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.assistant:read', 'consumer#instance.assistant:read']
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .query('default', Paginator.validate(v.object({})))
      .outputList(assistantPresenter)
      .do(async ctx => {
        let paginator = await assistantService.list({
          instance: ctx.instance
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, assistant =>
          assistantPresenter.present({ assistant, organization: ctx.organization })
        );
      }),

    getAssistant: instanceGroup
      .get(instancePath('assistants/:assistantId', 'assistants.get'), {
        name: 'Get assistant',
        description: 'Get an assistant available in an instance.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.assistant:read', 'consumer#instance.assistant:read']
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .output(assistantPresenter)
      .do(async ctx => {
        let assistant = await assistantService.get({
          instance: ctx.instance,
          assistantId: requireParam(ctx.params, 'assistantId')
        });

        return assistantPresenter.present({ assistant, organization: ctx.organization });
      }),

    listConversations: instanceGroup
      .get(instancePath('conversations', 'conversations.list'), {
        name: 'List assistant conversations',
        description: 'List assistant conversations in an instance.'
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.assistant.conversation:read',
            'consumer#instance.assistant.conversation:read'
          ]
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .query(
        'default',
        Paginator.validate(
          v.object({
            assistant_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .outputList(assistantConversationPresenter)
      .do(async ctx => {
        let assistantIds = normalizeArrayParam(ctx.query.assistant_id);
        let paginator = await assistantConversationService.list({
          organization: ctx.organization,
          instance: ctx.instance,
          ...requireAssistantActor(ctx),
          assistantIds
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, assistantConversation =>
          assistantConversationPresenter.present({
            assistantConversation,
            organization: ctx.organization,
            instance: ctx.instance
          })
        );
      }),

    createConversation: instanceGroup
      .post(instancePath('conversations', 'conversations.create'), {
        name: 'Create assistant conversation',
        description: 'Create a new assistant conversation in an instance.'
      })
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
          assistant_id: v.string(),
          title: v.optional(v.string())
        })
      )
      .output(assistantConversationPresenter)
      .do(async ctx => {
        let assistantConversation = await assistantConversationService.create({
          organization: ctx.organization,
          instance: ctx.instance,
          ...requireAssistantActor(ctx),
          assistantId: ctx.body.assistant_id,
          title: ctx.body.title
        });

        return assistantConversationPresenter.present({
          assistantConversation,
          organization: ctx.organization,
          instance: ctx.instance
        });
      }),

    getConversation: assistantConversationGroup
      .get(instancePath('conversations/:assistantConversationId', 'conversations.get'), {
        name: 'Get assistant conversation',
        description: 'Get a specific assistant conversation.'
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.assistant.conversation:read',
            'consumer#instance.assistant.conversation:read'
          ]
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .output(assistantConversationPresenter)
      .do(async ctx => {
        return assistantConversationPresenter.present({
          assistantConversation: ctx.assistantConversation,
          organization: ctx.organization,
          instance: ctx.instance
        });
      }),

    updateConversation: assistantConversationGroup
      .patch(instancePath('conversations/:assistantConversationId', 'conversations.update'), {
        name: 'Update assistant conversation',
        description: 'Update a specific assistant conversation.'
      })
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
          title: v.optional(v.string())
        })
      )
      .output(assistantConversationPresenter)
      .do(async ctx => {
        let assistantConversation = await assistantConversationService.update({
          organization: ctx.organization,
          instance: ctx.instance,
          ...requireAssistantActor(ctx),
          conversationId: ctx.assistantConversation.id,
          title: ctx.body.title
        });

        return assistantConversationPresenter.present({
          assistantConversation,
          organization: ctx.organization,
          instance: ctx.instance
        });
      }),

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
          description:
            'Create a user message and assistant request in a specific conversation.'
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
  }
);
