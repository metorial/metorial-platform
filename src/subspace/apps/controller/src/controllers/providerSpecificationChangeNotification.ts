import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerSpecificationChangeNotificationService } from '@metorial-subspace/module-catalog';
import { providerSpecificationChangeNotificationPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

let notificationTargetValidator = v.enumOf(['version', 'deployment_config_pair']);

export let providerSpecificationChangeNotificationApp = tenantApp.use(async ctx => {
  let notificationId = ctx.body.notificationId;
  if (!notificationId) {
    throw new Error('Provider specification change notification ID is required');
  }

  let providerSpecificationChangeNotification =
    await providerSpecificationChangeNotificationService.getProviderSpecificationChangeNotificationById(
      {
        notificationId,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      }
    );

  return { providerSpecificationChangeNotification };
});

export let providerSpecificationChangeNotificationController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          ids: v.optional(v.array(v.string())),
          targets: v.optional(v.array(notificationTargetValidator)),
          providerIds: v.optional(v.array(v.string())),
          providerVersionIds: v.optional(v.array(v.string())),
          providerSpecificationIds: v.optional(v.array(v.string())),
          createdAt: createdAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator =
        await providerSpecificationChangeNotificationService.listProviderSpecificationChangeNotifications(
          {
            tenant: ctx.tenant,
            environment: ctx.environment,
            solution: ctx.solution,
            ids: ctx.input.ids,
            targets: ctx.input.targets,
            providerIds: ctx.input.providerIds,
            providerVersionIds: ctx.input.providerVersionIds,
            providerSpecificationIds: ctx.input.providerSpecificationIds,
            createdAt: ctx.input.createdAt
          }
        );

      return Paginator.presentLight(
        await paginator.run(ctx.input),
        providerSpecificationChangeNotificationPresenter
      );
    }),

  get: providerSpecificationChangeNotificationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        notificationId: v.string()
      })
    )
    .do(async ctx =>
      providerSpecificationChangeNotificationPresenter(
        ctx.providerSpecificationChangeNotification
      )
    )
});
