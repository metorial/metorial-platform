import { v } from '@lowerdeck/validation';
import { triggerEventInvocationPresenter } from '../../presenters';
import { triggerEventInvocationService } from '../../services';
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
