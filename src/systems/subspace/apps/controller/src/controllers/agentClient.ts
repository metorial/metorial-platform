import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { agentClientService } from '@metorial-subspace/module-agent';
import { agentClientPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let agentClientApp = tenantApp.use(async ctx => {
  let agentClientId = ctx.body.agentClientId;
  if (!agentClientId) throw new Error('AgentClient ID is required');

  let agentClient = await agentClientService.getAgentClientById({
    agentClientId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { agentClient };
});

export let agentClientController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          search: v.optional(v.string()),

          types: v.optional(v.array(v.enumOf(['mcp_client_oauth']))),
          ids: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await agentClientService.listAgentClients({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        search: ctx.input.search,

        types: ctx.input.types,
        ids: ctx.input.ids,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, agentClientPresenter);
    }),

  get: agentClientApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        agentClientId: v.string()
      })
    )
    .do(async ctx => agentClientPresenter(ctx.agentClient))
});
