import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { agentService } from '@metorial-subspace/module-agent';
import { agentPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let agentApp = tenantApp.use(async ctx => {
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

export let agentController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          search: v.optional(v.string()),

          status: v.optional(v.array(v.enumOf(['active', 'archived', 'deleted']))),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          actorIds: v.optional(v.array(v.string())),
          types: v.optional(v.array(v.enumOf(['mcp_client', 'custom', 'tool_call']))),
          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await agentService.listAgents({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        search: ctx.input.search,

        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,

        ids: ctx.input.ids,
        actorIds: ctx.input.actorIds,
        types: ctx.input.types,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, agentPresenter);
    }),

  get: agentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        agentId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => agentPresenter(ctx.agent)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        name: v.string(),
        slug: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let agent = await agentService.createAgent({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        input: {
          name: ctx.input.name,
          slug: ctx.input.slug,
          description: ctx.input.description,
          metadata: ctx.input.metadata
        }
      });

      return agentPresenter(agent);
    }),

  update: agentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        agentId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let agent = await agentService.updateAgent({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        agent: ctx.agent,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata
        }
      });

      return agentPresenter(agent);
    }),

  delete: agentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        agentId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let agent = await agentService.archiveAgent({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        agent: ctx.agent
      });

      return agentPresenter(agent);
    })
});
