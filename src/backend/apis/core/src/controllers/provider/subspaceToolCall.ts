import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceToolCallService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath, instanceGroup } from '../../middleware/instanceGroup';
import { subspaceToolCallPresenter } from '../../presenters';
import { SubspaceToolCall } from '../../presenters/types';
import { subspaceSessionGroup } from './subspaceSession';

export let subspaceToolCallGroup = subspaceSessionGroup.use(async ctx => {
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

let toolCallListQuery = Paginator.validate(
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
    tool_id: v.optional(v.union([v.string(), v.array(v.string())]), {
      description: 'Filter by tool ID(s)'
    })
  })
);

export let subspaceToolCallController = Controller.create(
  {
    name: 'Tool Calls',
    description:
      'Tool calls represent individual tool invocations within a session. They track the input, output, and status of each tool execution.'
  },
  {
    listAll: instanceGroup
      .get(instancePath('tool-calls', 'toolCalls.list'), {
        name: 'List all tool calls',
        description: 'Returns a paginated list of tool calls across all sessions.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(subspaceToolCallPresenter)
      .query('default', toolCallListQuery)
      .do(async ctx => {
        let paginator = await subspaceToolCallService.list({
          instance: ctx.instance,
          sessionTemplateIds: normalizeArrayParam(ctx.query.session_template_id),
          sessionProviderIds: normalizeArrayParam(ctx.query.session_provider_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          toolIds: normalizeArrayParam(ctx.query.tool_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, toolCall =>
          subspaceToolCallPresenter.present({
            toolCall: toolCall as SubspaceToolCall
          })
        );
      }),

    getById: instanceGroup
      .get(instancePath('tool-calls/:toolCallId', 'toolCalls.get'), {
        name: 'Get tool call',
        description: 'Retrieves a specific tool call by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(subspaceToolCallPresenter)
      .do(async ctx => {
        let toolCall = await subspaceToolCallService.get({
          instance: ctx.instance,
          toolCallId: ctx.params.toolCallId
        });
        return subspaceToolCallPresenter.present({
          toolCall: toolCall as SubspaceToolCall
        });
      }),

    list: subspaceSessionGroup
      .get(instancePath('sessions/:sessionId/tool-calls', 'sessions.toolCalls.list'), {
        name: 'List tool calls',
        description: 'Returns a paginated list of tool calls for a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(subspaceToolCallPresenter)
      .query('default', toolCallListQuery)
      .do(async ctx => {
        let paginator = await subspaceToolCallService.list({
          instance: ctx.instance,
          sessionIds: [ctx.session.id],
          sessionTemplateIds: normalizeArrayParam(ctx.query.session_template_id),
          sessionProviderIds: normalizeArrayParam(ctx.query.session_provider_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          toolIds: normalizeArrayParam(ctx.query.tool_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, toolCall =>
          subspaceToolCallPresenter.present({
            toolCall: toolCall as SubspaceToolCall
          })
        );
      }),

    get: subspaceToolCallGroup
      .get(
        instancePath(
          'sessions/:sessionId/tool-calls/:toolCallId',
          'sessions.toolCalls.get'
        ),
        {
          name: 'Get tool call',
          description: 'Retrieves a specific tool call for a session.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(subspaceToolCallPresenter)
      .do(async ctx => {
        return subspaceToolCallPresenter.present({ toolCall: ctx.toolCall });
      }),

    create: subspaceSessionGroup
      .post(instancePath('sessions/:sessionId/tool-calls', 'sessions.toolCalls.create'), {
        name: 'Create tool call',
        description: 'Creates a new tool call in a session by invoking a specific tool.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .output(subspaceToolCallPresenter)
      .body(
        'default',
        v.object({
          tool_id: v.string({ description: 'The ID of the tool to call' }),
          input: v.record(v.any(), { description: 'Input data to pass to the tool' }),
          metadata: v.optional(
            v.record(v.any(), { description: 'Optional metadata for the tool call' })
          )
        })
      )
      .do(async ctx => {
        let toolCall = await subspaceToolCallService.create({
          instance: ctx.instance,
          sessionId: ctx.session.id,
          toolId: ctx.body.tool_id,
          input: ctx.body.input,
          metadata: ctx.body.metadata
        });

        return subspaceToolCallPresenter.present({
          toolCall: toolCall as SubspaceToolCall
        });
      })
  }
);
