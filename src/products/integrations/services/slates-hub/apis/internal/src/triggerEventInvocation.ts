import { v } from '@lowerdeck/validation';
import { triggerEventInvocationPresenter } from '@mtsrc/slates-hub-presenters';
import { triggerEventInvocationService } from '@mtsrc/slates-hub-module-triggers/triggerEventInvocation';
import { app } from './_app';
import { tenantApp } from './tenant';

export let triggerEventInvocationController = app.controller({
  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        triggerEventIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let invocations =
        await triggerEventInvocationService.getManyTriggerEventInvocationsByTriggerEventIds({
          tenant: ctx.tenant,
          triggerEventIds: ctx.input.triggerEventIds
        });

      return await Promise.all(invocations.map(triggerEventInvocationPresenter));
    })
});
