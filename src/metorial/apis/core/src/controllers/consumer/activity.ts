import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerActivityService } from '@metorial/module-consumer';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../lib/dateFilter';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { consumerGroup, consumerPath } from '../../middleware/consumerGroup';
import {
  consumerActivityAgentPresenter,
  consumerActivitySessionConnectionPresenter,
  identityCredentialPresenter,
  toolCallPresenter
} from '@metorial/presenters';

let activityInput = (ctx: {
  instance: Parameters<typeof consumerActivityService.listAgents>[0]['instance'];
  consumerProfile: Parameters<typeof consumerActivityService.listAgents>[0]['consumerProfile'];
  accessTags: NonNullable<
    Parameters<typeof consumerActivityService.listAgents>[0]['accessTags']
  >;
}) => ({
  instance: ctx.instance,
  consumerProfile: ctx.consumerProfile,
  accessTags: ctx.accessTags
});

export let consumerActivityController = Controller.create(
  {
    name: 'Consumer Activity',
    description:
      'Inspect runtime clients, connections, operations, and credentials for the authenticated consumer profile.',
    hideInDocs: true
  },
  {
    listAgents: consumerGroup
      .get(consumerPath('agents', 'agents.list'), {
        name: 'List consumer runtime clients',
        description:
          'Returns MCP clients observed in Magic MCP sessions accessible to the authenticated profile.'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.operations:read'] }))
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string())
          })
        )
      )
      .outputList(consumerActivityAgentPresenter)
      .do(async ctx => {
        let list = await consumerActivityService.listAgents({
          ...activityInput(ctx),
          pagination: ctx.query,
          search: ctx.query.search
        });

        return Paginator.present(list, agent => consumerActivityAgentPresenter.present(agent));
      }),

    getAgent: consumerGroup
      .get(consumerPath('agents/:agentId', 'agents.get'), {
        name: 'Get consumer runtime client',
        description: 'Retrieves one MCP client observed in an accessible Magic MCP session.'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.operations:read'] }))
      .output(consumerActivityAgentPresenter)
      .do(async ctx => {
        let agent = await consumerActivityService.getAgent({
          ...activityInput(ctx),
          agentId: ctx.params.agentId!
        });

        return consumerActivityAgentPresenter.present(agent);
      }),

    listSessionConnections: consumerGroup
      .get(consumerPath('session-connections', 'sessionConnections.list'), {
        name: 'List consumer session connections',
        description:
          'Returns connections from Magic MCP sessions accessible to the authenticated profile.'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.operations:read'] }))
      .query(
        'default',
        Paginator.validate(
          v.object({
            connection_state: v.optional(
              v.union([
                v.enumOf(['connected', 'disconnected']),
                v.array(v.enumOf(['connected', 'disconnected']))
              ])
            ),
            agent_id: v.optional(v.string()),
            session_id: v.optional(v.string()),
            created_at: dateFilterValidator('session connection creation time')
          })
        )
      )
      .outputList(consumerActivitySessionConnectionPresenter)
      .do(async ctx => {
        let list = await consumerActivityService.listSessionConnections({
          ...activityInput(ctx),
          pagination: ctx.query,
          connectionState: normalizeArrayParam(ctx.query.connection_state),
          agentId: ctx.query.agent_id,
          sessionId: ctx.query.session_id,
          createdAt: ctx.query.created_at
        });

        return Paginator.present(list, connection =>
          consumerActivitySessionConnectionPresenter.present(connection)
        );
      }),

    getSessionConnection: consumerGroup
      .get(
        consumerPath('session-connections/:sessionConnectionId', 'sessionConnections.get'),
        {
          name: 'Get consumer session connection',
          description:
            'Retrieves one connection from a Magic MCP session accessible to the authenticated profile.'
        }
      )
      .use(checkAccess({ possibleScopes: ['consumer#instance.operations:read'] }))
      .output(consumerActivitySessionConnectionPresenter)
      .do(async ctx => {
        let connection = await consumerActivityService.getSessionConnection({
          ...activityInput(ctx),
          sessionConnectionId: ctx.params.sessionConnectionId!
        });

        return consumerActivitySessionConnectionPresenter.present(connection);
      }),

    listToolCalls: consumerGroup
      .get(consumerPath('tool-calls', 'toolCalls.list'), {
        name: 'List consumer tool calls',
        description:
          'Returns read-only tool-call activity for identities owned by the authenticated profile actor.'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.operations:read'] }))
      .query(
        'default',
        Paginator.validate(
          v.object({
            agent_id: v.optional(v.string()),
            tool_id: v.optional(v.string()),
            provider_ids: v.optional(v.union([v.string(), v.array(v.string())])),
            connection_id: v.optional(v.string()),
            created_at: dateFilterValidator('tool call creation time')
          })
        )
      )
      .outputList(toolCallPresenter)
      .do(async ctx => {
        let list = await consumerActivityService.listToolCalls({
          ...activityInput(ctx),
          pagination: ctx.query,
          agentId: ctx.query.agent_id,
          toolId: ctx.query.tool_id,
          providerIds: normalizeArrayParam(ctx.query.provider_ids),
          sessionConnectionId: ctx.query.connection_id,
          createdAt: ctx.query.created_at
        });

        return Paginator.present(list, toolCall => toolCallPresenter.present({ toolCall }));
      }),

    getToolCall: consumerGroup
      .get(consumerPath('tool-calls/:toolCallId', 'toolCalls.get'), {
        name: 'Get consumer tool call',
        description:
          'Retrieves one tool call belonging to an identity owned by the authenticated profile actor.'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.operations:read'] }))
      .output(toolCallPresenter)
      .do(async ctx => {
        let toolCall = await consumerActivityService.getToolCall({
          ...activityInput(ctx),
          toolCallId: ctx.params.toolCallId!
        });

        return toolCallPresenter.present({ toolCall });
      }),

    listIdentityCredentials: consumerGroup
      .get(consumerPath('identity-credentials', 'identityCredentials.list'), {
        name: 'List consumer identity credentials',
        description:
          'Returns read-only credentials for identities owned by the authenticated profile actor.'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.identity:read'] }))
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_id: v.optional(v.string()),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ])
            )
          })
        )
      )
      .outputList(identityCredentialPresenter)
      .do(async ctx => {
        let list = await consumerActivityService.listIdentityCredentials({
          ...activityInput(ctx),
          pagination: ctx.query,
          providerId: ctx.query.provider_id,
          status: normalizeArrayParam(ctx.query.status)
        });

        return Paginator.present(list, identityCredential =>
          identityCredentialPresenter.present({ identityCredential })
        );
      }),

    getIdentityCredential: consumerGroup
      .get(
        consumerPath('identity-credentials/:identityCredentialId', 'identityCredentials.get'),
        {
          name: 'Get consumer identity credential',
          description:
            'Retrieves one credential belonging to an identity owned by the authenticated profile actor.'
        }
      )
      .use(checkAccess({ possibleScopes: ['consumer#instance.identity:read'] }))
      .output(identityCredentialPresenter)
      .do(async ctx => {
        let identityCredential = await consumerActivityService.getIdentityCredential({
          ...activityInput(ctx),
          identityCredentialId: ctx.params.identityCredentialId!
        });

        return identityCredentialPresenter.present({ identityCredential });
      })
  }
);
