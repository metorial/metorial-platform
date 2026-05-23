import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { slateTriggerEventInputPresenter } from '../../presenters/slateTriggerEventInput';
import { slateTriggerEventInputService } from '../../services/slateTriggerEventInput';
import { app } from './_app';
import { tenantApp } from './tenant';

export let slateTriggerEventInputController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          triggerReceiverIds: v.optional(v.array(v.string())),
          statuses: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateTriggerEventInputService.listTriggerEventInputs({
        tenant: ctx.tenant,
        receiverIds: ctx.input.triggerReceiverIds,
        statuses: ctx.input.statuses
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateTriggerEventInputPresenter);
    })
});
