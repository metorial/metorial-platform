import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { triggerRegistrationPresenter } from '../../presenters';
import { triggerRegistrationService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let triggerRegistrationApp = tenantApp.use(async ctx => {
  let triggerRegistrationId = ctx.body.triggerRegistrationId;
  if (!triggerRegistrationId) throw new Error('Trigger Registration ID is required');

  let triggerRegistration = await triggerRegistrationService.getTriggerRegistrationById({
    id: triggerRegistrationId,
    tenant: ctx.tenant
  });

  return { triggerRegistration };
});

export let triggerRegistrationController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          slateInstanceIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await triggerRegistrationService.listTriggerRegistrations({
        tenant: ctx.tenant,
        slateInstanceIds: ctx.input.slateInstanceIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, triggerRegistrationPresenter);
    }),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateInstanceId: v.string(),
        authConfigId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let registration = await triggerRegistrationService.createTriggerRegistration({
        tenant: ctx.tenant,
        input: {
          slateInstanceId: ctx.input.slateInstanceId,
          authConfigId: ctx.input.authConfigId
        }
      });

      return triggerRegistrationPresenter(registration);
    }),

  get: triggerRegistrationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        triggerRegistrationId: v.string()
      })
    )
    .do(async ctx => triggerRegistrationPresenter(ctx.triggerRegistration)),

  delete: triggerRegistrationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        triggerRegistrationId: v.string()
      })
    )
    .do(async ctx => {
      await triggerRegistrationService.deleteTriggerRegistration({
        tenant: ctx.tenant,
        registration: ctx.triggerRegistration
      });

      return { success: true };
    })
});
