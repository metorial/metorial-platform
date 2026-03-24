import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { slateTriggerInvocationPresenter } from '../../presenters';
import { slateTriggerInvocationService } from '../../services';
import { SlateTriggerInvocationType } from '../../../prisma/generated/client';
import { app } from './_app';
import { tenantApp } from './tenant';

export let slateTriggerInvocationApp = tenantApp.use(async ctx => {
  let slateTriggerInvocationId = ctx.body.slateTriggerInvocationId;
  if (!slateTriggerInvocationId) throw new Error('Trigger invocation ID is required');

  let invocation = await slateTriggerInvocationService.getTriggerInvocationById({
    tenant: ctx.tenant,
    id: slateTriggerInvocationId
  });

  return { invocation };
});

export let slateTriggerInvocationController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          triggerReceiverIds: v.optional(v.array(v.string())),
          triggerReceiverTriggerIds: v.optional(v.array(v.string())),
          types: v.optional(
            v.array(
              v.enumOf([
                SlateTriggerInvocationType.poll,
                SlateTriggerInvocationType.webhook_handle,
                SlateTriggerInvocationType.map_event,
                SlateTriggerInvocationType.webhook_register,
                SlateTriggerInvocationType.webhook_unregister
              ])
            )
          )
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateTriggerInvocationService.listTriggerInvocations({
        tenant: ctx.tenant,
        receiverIds: ctx.input.triggerReceiverIds,
        receiverTriggerIds: ctx.input.triggerReceiverTriggerIds,
        types: ctx.input.types
      });

      let list = await paginator.run(ctx.input);

      return await Paginator.presentLight(list, slateTriggerInvocationPresenter);
    }),

  get: slateTriggerInvocationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateTriggerInvocationId: v.string()
      })
    )
    .do(async ctx => slateTriggerInvocationPresenter(ctx.invocation)),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateTriggerInvocationIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let invocations = await slateTriggerInvocationService.getManyTriggerInvocationsById({
        tenant: ctx.tenant,
        ids: ctx.input.slateTriggerInvocationIds
      });

      return Promise.all(invocations.map(slateTriggerInvocationPresenter));
    })
});
