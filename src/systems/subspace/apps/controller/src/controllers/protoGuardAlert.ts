import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { protoGuardAlertService } from '@metorial-subspace/module-monitor';
import { protoGuardAlertPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let protoGuardAlertApp = tenantApp.use(async ctx => {
  let alertId = ctx.body.alertId;
  if (!alertId) throw new Error('Protoguard alert ID is required');

  let alert = await protoGuardAlertService.getAlertById({
    alertId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { alert };
});

export let protoGuardAlertController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          ids: v.optional(v.array(v.string())),
          runIds: v.optional(v.array(v.string())),
          filterIds: v.optional(v.array(v.string())),
          sessionIds: v.optional(v.array(v.string())),
          sessionMessageIds: v.optional(v.array(v.string())),
          sessionConnectionIds: v.optional(v.array(v.string())),
          providerRunIds: v.optional(v.array(v.string())),
          createdAt: createdAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await protoGuardAlertService.listAlerts({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        ids: ctx.input.ids,
        runIds: ctx.input.runIds,
        filterIds: ctx.input.filterIds,
        sessionIds: ctx.input.sessionIds,
        sessionMessageIds: ctx.input.sessionMessageIds,
        sessionConnectionIds: ctx.input.sessionConnectionIds,
        providerRunIds: ctx.input.providerRunIds,
        createdAt: ctx.input.createdAt
      });

      return Paginator.presentLight(await paginator.run(ctx.input), protoGuardAlertPresenter);
    }),

  get: protoGuardAlertApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        alertId: v.string()
      })
    )
    .do(async ctx => protoGuardAlertPresenter(ctx.alert))
});
