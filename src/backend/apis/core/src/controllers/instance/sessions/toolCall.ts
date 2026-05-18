import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceToolCallService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { toolCallPresenter } from '../../../presenters';
import { resolveActorIdsForLogFilters } from './_logFilterActors';

let toolCallGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.toolCallId) {
    throw new ServiceError(
      badRequestError({
        message: 'toolCallId is required',
        description: 'The toolCallId path parameter is required.'
      })
    );
  }

  let toolCall = await subspaceToolCallService.get({
    instance: ctx.instance,
    toolCallId: ctx.params.toolCallId
  });

  return { toolCall };
});

export let toolCallController = Controller.create(
  {
    name: 'Tool Calls',
    description:
      'Tool calls represent individual tool invocations within a session. They track the input, output, and status of each tool execution.'
  },
  {
    list: instanceGroup
      .get(instancePath('tool-calls', 'toolCalls.list'), {
        name: 'List all tool calls',
        description: 'Returns a paginated list of tool calls across all sessions.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(toolCallPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            session_template_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session template ID(s)'
            }),
            session_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session provider ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider deployment ID(s)'
            }),
            provider_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider config ID(s)'
            }),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider auth config ID(s)'
            }),
            agent_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by agent ID(s)'
            }),
            actor_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by identity actor ID(s)'
            }),
            consumer_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by consumer ID(s)'
            }),
            identity_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by identity ID(s)'
            }),
            agent_instance_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by agent instance ID(s)'
            }),
            tool_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by tool ID(s)'
            }),
            created_at: dateFilterValidator('tool call creation time'),
            updated_at: dateFilterValidator('tool call last update time')
          })
        )
      )
      .do(async ctx => {
        let actorIds = await resolveActorIdsForLogFilters({
          instance: ctx.instance,
          actorIds: normalizeArrayParam(ctx.query.actor_id),
          consumerIds: normalizeArrayParam(ctx.query.consumer_id),
          identityIds: normalizeArrayParam(ctx.query.identity_id)
        });

        console.log('Resolved actor IDs for tool call list filters:', {
          actorIds,
          consumerIds: normalizeArrayParam(ctx.query.consumer_id),
          identityIds: normalizeArrayParam(ctx.query.identity_id)
        });

        let paginator = await subspaceToolCallService.list({
          instance: ctx.instance,
          allowDeleted: false,
          agentIds: normalizeArrayParam(ctx.query.agent_id),
          actorIds,
          agentInstanceIds: normalizeArrayParam(ctx.query.agent_instance_id),
          sessionTemplateIds: normalizeArrayParam(ctx.query.session_template_id),
          sessionProviderIds: normalizeArrayParam(ctx.query.session_provider_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          toolIds: normalizeArrayParam(ctx.query.tool_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, toolCall =>
          toolCallPresenter.present({
            toolCall
          })
        );
      }),

    get: toolCallGroup
      .get(instancePath('tool-calls/:toolCallId', 'toolCalls.get'), {
        name: 'Get tool call',
        description: 'Retrieves a specific tool call by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(toolCallPresenter)
      .do(async ctx => {
        return toolCallPresenter.present({
          toolCall: ctx.toolCall
        });
      }),

    create: instanceGroup
      .post(instancePath('tool-calls', 'toolCalls.create'), {
        name: 'Create tool call',
        description: 'Creates a new tool call in a session by invoking a specific tool.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .output(toolCallPresenter)
      .body(
        'default',
        v.object({
          tool_id: v.string({ description: 'The ID of the tool to call' }),
          input: v.record(v.any(), { description: 'Input data to pass to the tool' }),
          metadata: v.optional(
            v.record(v.any(), { description: 'Optional metadata for the tool call' })
          ),
          session_id: v.string({
            description: 'The ID of the session to which this tool call belongs'
          })
        })
      )
      .do(async ctx => {
        let toolCall = await subspaceToolCallService.create({
          instance: ctx.instance,
          sessionId: ctx.body.session_id,
          toolId: ctx.body.tool_id,
          input: ctx.body.input,
          metadata: ctx.body.metadata
        });

        return toolCallPresenter.present({
          toolCall
        });
      })
  }
);
