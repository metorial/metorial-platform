import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { providerRunLogsService, providerRunService } from '@metorial-subspace/module-session';
import { providerRunPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let providerRunApp = tenantApp.use(async ctx => {
  let providerRunId = ctx.body.providerRunId;
  if (!providerRunId) throw new Error('ProviderRun ID is required');

  let providerRun = await providerRunService.getProviderRunById({
    providerRunId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { providerRun };
});

export let providerRunController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          status: v.optional(v.array(v.enumOf(['running', 'stopped']))),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          sessionIds: v.optional(v.array(v.string())),
          sessionProviderIds: v.optional(v.array(v.string())),
          sessionConnectionIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerVersionIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerRunService.listProviderRuns({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,

        ids: ctx.input.ids,
        sessionIds: ctx.input.sessionIds,
        sessionProviderIds: ctx.input.sessionProviderIds,
        sessionConnectionIds: ctx.input.sessionConnectionIds,
        providerIds: ctx.input.providerIds,
        providerVersionIds: ctx.input.providerVersionIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerRunPresenter);
    }),

  get: providerRunApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerRunId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => providerRunPresenter(ctx.providerRun)),

  getLogs: providerRunApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerRunId: v.string(),
        sessionMessageIds: v.optional(v.array(v.string()))
      })
    )
    .do(async ctx =>
      providerRunLogsService.getProviderRunLogs({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        providerRun: ctx.providerRun,
        inputs: {
          sessionMessageIds: ctx.input.sessionMessageIds
        }
      })
    )
});
