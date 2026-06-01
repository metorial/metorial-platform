import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { alertService } from '@metorial-subspace/module-monitor';
import { actorService } from '@metorial-subspace/module-tenant';
import { monitorAlertPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

let monitorTargetValidator = v.enumOf(['protoguard_filter', 'schema_change']);
let monitorOwnerValidator = v.enumOf(['tenant', 'system']);
let monitorAlertStatusValidator = v.enumOf(['pending', 'resolved']);
let monitorAlertSourceValidator = v.enumOf(['protoguard', 'specification_change']);

let getOptionalActor = async (ctx: { tenant: any; input: { actorId?: string } }) =>
  ctx.input.actorId
    ? await actorService.getActorById({
        tenant: ctx.tenant,
        id: ctx.input.actorId
      })
    : null;

export let monitorAlertApp = tenantApp.use(async ctx => {
  let alertId = ctx.body.alertId;
  if (!alertId) throw new Error('Monitor alert ID is required');

  let alert = await alertService.getAlertById({
    alertId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { alert };
});

export let monitorAlertController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          ids: v.optional(v.array(v.string())),
          monitorIds: v.optional(v.array(v.string())),
          statuses: v.optional(v.array(monitorAlertStatusValidator)),
          targets: v.optional(v.array(monitorTargetValidator)),
          owners: v.optional(v.array(monitorOwnerValidator)),
          protoGuardAlertIds: v.optional(v.array(v.string())),
          protoGuardRunIds: v.optional(v.array(v.string())),
          protoGuardFilterIds: v.optional(v.array(v.string())),
          specificationChangeNotificationIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          sessionIds: v.optional(v.array(v.string())),
          sessionMessageIds: v.optional(v.array(v.string())),
          sessionConnectionIds: v.optional(v.array(v.string())),
          providerRunIds: v.optional(v.array(v.string())),
          sources: v.optional(v.array(monitorAlertSourceValidator)),
          createdAt: createdAtValidator,
          resolvedAt: createdAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await alertService.listAlerts({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        ids: ctx.input.ids,
        monitorIds: ctx.input.monitorIds,
        statuses: ctx.input.statuses,
        targets: ctx.input.targets,
        owners: ctx.input.owners,
        protoGuardAlertIds: ctx.input.protoGuardAlertIds,
        protoGuardRunIds: ctx.input.protoGuardRunIds,
        protoGuardFilterIds: ctx.input.protoGuardFilterIds,
        specificationChangeNotificationIds: ctx.input.specificationChangeNotificationIds,
        providerIds: ctx.input.providerIds,
        sessionIds: ctx.input.sessionIds,
        sessionMessageIds: ctx.input.sessionMessageIds,
        sessionConnectionIds: ctx.input.sessionConnectionIds,
        providerRunIds: ctx.input.providerRunIds,
        sources: ctx.input.sources,
        createdAt: ctx.input.createdAt,
        resolvedAt: ctx.input.resolvedAt
      });

      return Paginator.presentLight(await paginator.run(ctx.input), monitorAlertPresenter);
    }),

  get: monitorAlertApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        alertId: v.string(),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx =>
      monitorAlertPresenter(
        await alertService.getAlertById({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,
          alertId: ctx.input.alertId,
          actor: await getOptionalActor(ctx)
        })
      )
    ),

  viewed: monitorAlertApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        alertId: v.string(),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx =>
      monitorAlertPresenter(
        await alertService.markViewed({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,
          alertId: ctx.input.alertId,
          actor: await getOptionalActor(ctx)
        })
      )
    ),

  resolve: monitorAlertApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        alertId: v.string(),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx =>
      monitorAlertPresenter(
        await alertService.resolveAlert({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,
          alertId: ctx.input.alertId,
          actor: await getOptionalActor(ctx)
        })
      )
    ),

  unresolve: monitorAlertApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        alertId: v.string(),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx =>
      monitorAlertPresenter(
        await alertService.unresolveAlert({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,
          alertId: ctx.input.alertId,
          actor: await getOptionalActor(ctx)
        })
      )
    )
});
