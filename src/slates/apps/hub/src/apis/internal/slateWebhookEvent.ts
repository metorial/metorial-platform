import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { slateWebhookEventPresenter } from '../../presenters';
import { slateWebhookEventService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let slateWebhookEventApp = tenantApp.use(async ctx => {
  let webhookEventId = ctx.body.webhookEventId;
  if (!webhookEventId) throw new Error('Webhook Event ID is required');

  let webhookEvent = await slateWebhookEventService.getSlateWebhookEventById({
    id: webhookEventId,
    tenant: ctx.tenant
  });

  return { webhookEvent };
});

export let slateWebhookEventController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          webhookRegistrationIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateWebhookEventService.listSlateWebhookEvents({
        tenant: ctx.tenant,
        webhookRegistrationIds: ctx.input.webhookRegistrationIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateWebhookEventPresenter);
    }),

  get: slateWebhookEventApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        webhookEventId: v.string()
      })
    )
    .do(async ctx => slateWebhookEventPresenter(ctx.webhookEvent)),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        webhookEventIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let events = await slateWebhookEventService.getManySlateWebhookEventsByIds({
        tenant: ctx.tenant,
        ids: ctx.input.webhookEventIds
      });

      return events.map(slateWebhookEventPresenter);
    })
});
