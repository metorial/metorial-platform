import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { assistantConversationService } from '@metorial/module-assistant';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { assistantConversationPresenter } from '../../../presenters';
import { assistantConversationGroup, requireAssistantActor } from './context';

export let assistantConversationHandlers = {
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
    })
};
