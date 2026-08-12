import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { agentInstanceService, agentService } from '@metorial-subspace/module-agent';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { agentInstancePresenter, agentPresenter } from '@metorial/presenters';

let agentGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.agentId) {
    throw new ServiceError(
      badRequestError({
        message: 'agentId is required',
        description: 'The agentId path parameter is required.'
      })
    );
  }

  let agent = await agentService.getAgentById({
    instance: ctx.instance,
    agentId: ctx.params.agentId,
    allowDeleted: false
  });

  return { agent };
});

let agentInstanceGroup = agentGroup.use(async ctx => {
  if (!ctx.params.agentInstanceId) {
    throw new ServiceError(
      badRequestError({
        message: 'agentInstanceId is required',
        description: 'The agentInstanceId path parameter is required.'
      })
    );
  }

  let agentInstance = await agentInstanceService.getAgentInstanceById({
    instance: ctx.instance,
    agent: ctx.agent,
    agentInstanceId: ctx.params.agentInstanceId
  });

  return { agentInstance };
});

export let agentController = Controller.create(
  {
    name: 'Agents',
    description: 'Inspect agents and their linked clients and instances.',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('agents', 'agents.list'), {
        name: 'List agents',
        description: 'Returns a paginated list of agents for the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .outputList(agentPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string()),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ])
            ),
            type: v.optional(
              v.union([
                v.enumOf(['mcp_client', 'custom', 'tool_call']),
                v.array(v.enumOf(['mcp_client', 'custom', 'tool_call']))
              ])
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('agent creation time'),
            updated_at: dateFilterValidator('agent last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await agentService.listAgents({
          instance: ctx.instance,
          allowDeleted: true,
          search: ctx.query.search,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at,
          types: normalizeArrayParam(ctx.query.type)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, agent => agentPresenter.present({ agent }));
      }),

    get: agentGroup
      .get(instancePath('agents/:agentId', 'agents.get'), {
        name: 'Get agent',
        description: 'Retrieves a specific agent by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .output(agentPresenter)
      .do(async ctx => agentPresenter.present({ agent: ctx.agent })),

    listInstances: agentGroup
      .get(instancePath('agents/:agentId/instances', 'agents.instances.list'), {
        name: 'List agent instances',
        description: 'Returns a paginated list of instances for an agent.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .outputList(agentInstancePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            type: v.optional(
              v.union([
                v.enumOf(['mcp_client', 'tool_call']),
                v.array(v.enumOf(['mcp_client', 'tool_call']))
              ])
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            agent_client_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('agent instance creation time'),
            updated_at: dateFilterValidator('agent instance last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await agentInstanceService.listAgentInstances({
          instance: ctx.instance,
          agent: ctx.agent,
          ids: normalizeArrayParam(ctx.query.id),
          types: normalizeArrayParam(ctx.query.type),
          agentClientIds: normalizeArrayParam(ctx.query.agent_client_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, agentInstance =>
          agentInstancePresenter.present({ agentInstance })
        );
      }),

    getInstance: agentInstanceGroup
      .get(
        instancePath('agents/:agentId/instances/:agentInstanceId', 'agents.instances.get'),
        {
          name: 'Get agent instance',
          description: 'Retrieves a specific agent instance by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .output(agentInstancePresenter)
      .do(async ctx => agentInstancePresenter.present({ agentInstance: ctx.agentInstance }))
  }
);
