import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { isDevOnlyEnabled } from '../../../lib/isDevOnly';
import {
  adminWebhookEventPresenter,
  adminWebhookTriggerPresenter
} from '../../../presenters/adminWebhookTrigger';
import { slateWebhookEventService, slateWebhookRegistrationService } from '../../../services';
import { authedApp } from './_app';

export let devOnlyApp = authedApp.use(async () => {
  if (!isDevOnlyEnabled()) {
    throw new ServiceError(
      forbiddenError({
        message: 'This endpoint is only available in development.'
      })
    );
  }

  return {};
});

export let devWebhookTriggerApp = devOnlyApp.use(async ctx => {
  let webhookRegistrationId = ctx.body.webhookRegistrationId;
  if (!webhookRegistrationId) {
    throw new ServiceError(badRequestError({ message: 'Webhook Registration ID is required' }));
  }

  let webhookRegistration = await slateWebhookRegistrationService.getWebhookRegistrationForAdmin(
    { id: webhookRegistrationId }
  );

  return { webhookRegistration };
});

export let devWebhookTriggerController = devOnlyApp.controller({
  list: devOnlyApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          search: v.optional(v.string()),
          types: v.optional(v.array(v.enumOf(['automated', 'manual']))),
          owners: v.optional(v.array(v.enumOf(['tenant', 'global'])))
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateWebhookRegistrationService.listWebhookRegistrationsForAdmin({
        search: ctx.input.search,
        types: ctx.input.types,
        owners: ctx.input.owners
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, adminWebhookTriggerPresenter);
    }),

  get: devWebhookTriggerApp
    .handler()
    .input(v.object({ webhookRegistrationId: v.string() }))
    .do(async ctx => adminWebhookTriggerPresenter(ctx.webhookRegistration)),

  listEvents: devWebhookTriggerApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          webhookRegistrationId: v.string(),
          statuses: v.optional(
            v.array(v.enumOf(['pending', 'failed_retrying', 'failed_final', 'succeeded']))
          )
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateWebhookEventService.listWebhookEventsForAdmin({
        webhookRegistration: ctx.webhookRegistration,
        statuses: ctx.input.statuses
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, adminWebhookEventPresenter);
    }),

  sendEvent: devWebhookTriggerApp
    .handler()
    .input(
      v.object({
        webhookRegistrationId: v.string(),
        method: v.optional(
          v.enumOf(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
        ),
        path: v.optional(v.string()),
        headers: v.optional(v.record(v.string())),
        body: v.optional(v.string()),
        useLocalhostUrl: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let result = await slateWebhookEventService.sendWebhookEventForAdmin({
        registration: ctx.webhookRegistration,
        input: {
          method: ctx.input.method,
          path: ctx.input.path,
          headers: ctx.input.headers,
          body: ctx.input.body,
          useLocalhostUrl: ctx.input.useLocalhostUrl
        }
      });

      if (result.discarded) {
        return {
          discarded: true as const,
          eventId: result.eventId,
          event: null
        };
      }

      return {
        discarded: false as const,
        eventId: result.event.id,
        event: await adminWebhookEventPresenter(result.event)
      };
    })
});
