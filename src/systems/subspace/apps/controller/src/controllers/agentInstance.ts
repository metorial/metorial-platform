import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { agentInstanceService, agentService } from '@metorial-subspace/module-agent';
import { agentInstancePresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

let agentApp = tenantApp.use(async ctx => {
  let agentId = ctx.body.agentId;
  if (!agentId) throw new Error('Agent ID is required');

  let agent = await agentService.getAgentById({
    agentId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { agent };
});

export let agentInstanceApp = agentApp.use(async ctx => {
  let agentInstanceId = ctx.body.agentInstanceId;
  if (!agentInstanceId) throw new Error('AgentInstance ID is required');

  let agentInstance = await agentInstanceService.getAgentInstanceById({
    agentInstanceId,
    agent: ctx.agent,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { agentInstance };
});

export let agentInstanceController = app.controller({
  list: agentApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          agentId: v.string(),
          allowDeleted: v.optional(v.boolean()),

          types: v.optional(v.array(v.enumOf(['mcp_client', 'tool_call']))),
          ids: v.optional(v.array(v.string())),
          agentClientIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await agentInstanceService.listAgentInstances({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        agent: ctx.agent,

        types: ctx.input.types,
        ids: ctx.input.ids,
        agentClientIds: ctx.input.agentClientIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, agentInstancePresenter);
    }),

  get: agentInstanceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        agentId: v.string(),
        agentInstanceId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => agentInstancePresenter(ctx.agentInstance))
});
