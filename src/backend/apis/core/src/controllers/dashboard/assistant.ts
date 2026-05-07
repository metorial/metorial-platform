import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { OrganizationActor } from '@metorial/db';
import {
  assistantConversationService,
  assistantMessageService,
  assistantService
} from '@metorial/module-assistant';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { requireParam } from '../../lib/requireParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup } from '../../middleware/instanceGroup';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationManagementPath } from '../../middleware/organizationGroup';
import {
  assistantConversationPresenter,
  assistantMessagePresenter,
  assistantPresenter
} from '../../presenters';

let requireActor = (ctx: { actor?: OrganizationActor }) => {
  if (!ctx.actor) {
    throw new ServiceError(
      forbiddenError({
        message: 'Organization actor context is required',
        description: 'Assistant endpoints require an authenticated organization actor.'
      })
    );
  }

  return ctx.actor;
};

let assistantConversationGroup = instanceGroup.use(async ctx => {
  let assistantConversationId = requireParam(ctx.params, 'assistantConversationId');

  let assistantConversation = await assistantConversationService.getAssistantConversationById({
    organization: ctx.organization,
    instance: ctx.instance,
    actor: requireActor(ctx),
    conversationId: assistantConversationId
  });

  return { assistantConversation };
});

let assistantMessageGroup = assistantConversationGroup.use(async ctx => {
  let assistantMessageId = requireParam(ctx.params, 'assistantMessageId');

  let assistantConversationItem = await assistantMessageService.getAssistantMessageById({
    organization: ctx.organization,
    instance: ctx.instance,
    actor: requireActor(ctx),
    conversation: ctx.assistantConversation,
    messageId: assistantMessageId
  });

  return { assistantConversationItem };
});

export let dashboardAssistantController = Controller.create(
  {
    name: 'Assistants',
    description: 'Dashboard-only assistant and conversation endpoints'
  },
  {
    listAssistants: instanceGroup
      .use(isDashboardGroup())
      .get(organizationManagementPath('instances/:instanceId/assistants', 'assistants.list'), {
        name: 'List assistants',
        description: 'List assistants available to an organization.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .query('default', Paginator.validate(v.object({})))
      .outputList(assistantPresenter)
      .do(async ctx => {
        let paginator = await assistantService.listAvailableAssistants({
          organization: ctx.organization
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, assistant => assistantPresenter.present({ assistant }));
      }),

    getAssistant: instanceGroup
      .use(isDashboardGroup())
      .get(
        organizationManagementPath(
          'instances/:instanceId/assistants/:assistantId',
          'assistants.get'
        ),
        {
          name: 'Get assistant',
          description: 'Get an assistant available to an organization.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(assistantPresenter)
      .do(async ctx => {
        let assistant = await assistantService.getAvailableAssistant({
          organization: ctx.organization,
          assistantId: requireParam(ctx.params, 'assistantId')
        });

        return assistantPresenter.present({ assistant });
      }),

    listConversations: instanceGroup
      .use(isDashboardGroup())
      .get(
        organizationManagementPath(
          'instances/:instanceId/conversations',
          'conversations.list'
        ),
        {
          name: 'List assistant conversations',
          description: 'List assistant conversations in an instance.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
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
        let paginator = await assistantConversationService.listAssistantConversations({
          organization: ctx.organization,
          instance: ctx.instance,
          actor: requireActor(ctx),
          assistantIds
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, assistantConversation =>
          assistantConversationPresenter.present({
            assistantConversation
          })
        );
      }),

    createConversation: instanceGroup
      .use(isDashboardGroup())
      .post(
        organizationManagementPath(
          'instances/:instanceId/conversations',
          'conversations.create'
        ),
        {
          name: 'Create assistant conversation',
          description: 'Create a new assistant conversation in an instance.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          assistant_id: v.string(),
          title: v.optional(v.string())
        })
      )
      .output(assistantConversationPresenter)
      .do(async ctx => {
        let assistantConversation =
          await assistantConversationService.createAssistantConversation({
            organization: ctx.organization,
            instance: ctx.instance,
            actor: requireActor(ctx),
            context: ctx.context,
            input: {
              assistantId: ctx.body.assistant_id,
              title: ctx.body.title
            }
          });

        return assistantConversationPresenter.present({ assistantConversation });
      }),

    getConversation: assistantConversationGroup
      .use(isDashboardGroup())
      .get(
        organizationManagementPath(
          'instances/:instanceId/conversations/:assistantConversationId',
          'conversations.get'
        ),
        {
          name: 'Get assistant conversation',
          description: 'Get a specific assistant conversation.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(assistantConversationPresenter)
      .do(async ctx => {
        return assistantConversationPresenter.present({
          assistantConversation: ctx.assistantConversation
        });
      }),

    updateConversation: assistantConversationGroup
      .use(isDashboardGroup())
      .post(
        organizationManagementPath(
          'instances/:instanceId/conversations/:assistantConversationId',
          'conversations.update'
        ),
        {
          name: 'Update assistant conversation',
          description: 'Update a specific assistant conversation.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          title: v.optional(v.string())
        })
      )
      .output(assistantConversationPresenter)
      .do(async ctx => {
        let assistantConversation =
          await assistantConversationService.updateAssistantConversation({
            organization: ctx.organization,
            instance: ctx.instance,
            actor: requireActor(ctx),
            conversation: ctx.assistantConversation,
            context: ctx.context,
            input: {
              title: ctx.body.title
            }
          });

        return assistantConversationPresenter.present({ assistantConversation });
      }),

    listMessages: assistantConversationGroup
      .use(isDashboardGroup())
      .get(
        organizationManagementPath(
          'instances/:instanceId/conversations/:assistantConversationId/messages',
          'conversations.messages.list'
        ),
        {
          name: 'List assistant messages',
          description: 'List messages in a specific assistant conversation.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .query('default', Paginator.validate(v.object({})))
      .outputList(assistantMessagePresenter)
      .do(async ctx => {
        let paginator = await assistantMessageService.listAssistantMessages({
          organization: ctx.organization,
          instance: ctx.instance,
          actor: requireActor(ctx),
          conversation: ctx.assistantConversation
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, assistantConversationItem =>
          assistantMessagePresenter.present({ assistantConversationItem })
        );
      }),

    getMessage: assistantMessageGroup
      .use(isDashboardGroup())
      .get(
        organizationManagementPath(
          'instances/:instanceId/conversations/:assistantConversationId/messages/:assistantMessageId',
          'conversations.messages.get'
        ),
        {
          name: 'Get assistant message',
          description: 'Get a specific assistant message.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(assistantMessagePresenter)
      .do(async ctx =>
        assistantMessagePresenter.present({
          assistantConversationItem: ctx.assistantConversationItem
        })
      )
  }
);
