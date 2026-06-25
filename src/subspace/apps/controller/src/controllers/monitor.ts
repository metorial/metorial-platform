import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { monitorService } from '@metorial-subspace/module-monitor';
import { monitorPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

let monitorTargetValidator = v.enumOf(['protoguard_filter', 'schema_change']);
let monitorStatusValidator = v.enumOf(['active', 'inactive']);
let monitorOwnerValidator = v.enumOf(['tenant', 'system']);

export let monitorApp = tenantApp.use(async ctx => {
  let monitorId = ctx.body.monitorId;
  if (!monitorId) throw new Error('Monitor ID is required');

  let monitor = await monitorService.getMonitorById({
    monitorId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { monitor };
});

export let monitorController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          ids: v.optional(v.array(v.string())),
          targets: v.optional(v.array(monitorTargetValidator)),
          statuses: v.optional(v.array(monitorStatusValidator)),
          owners: v.optional(v.array(monitorOwnerValidator)),
          protoGuardFilterIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          search: v.optional(v.string()),
          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator,
          firstAlertAt: createdAtValidator,
          lastAlertAt: createdAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await monitorService.listMonitors({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        ids: ctx.input.ids,
        targets: ctx.input.targets,
        statuses: ctx.input.statuses,
        owners: ctx.input.owners,
        protoGuardFilterIds: ctx.input.protoGuardFilterIds,
        providerIds: ctx.input.providerIds,
        search: ctx.input.search,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt,
        firstAlertAt: ctx.input.firstAlertAt,
        lastAlertAt: ctx.input.lastAlertAt
      });

      return Paginator.presentLight(await paginator.run(ctx.input), monitorPresenter);
    }),

  get: monitorApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        monitorId: v.string()
      })
    )
    .do(async ctx => monitorPresenter(ctx.monitor))
});
