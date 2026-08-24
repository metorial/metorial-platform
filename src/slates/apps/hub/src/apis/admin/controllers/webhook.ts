import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { slateWebhookRegistrationPresenter } from '../../../presenters';
import { slateWebhookRegistrationService } from '../../../services';
import { authedApp } from './_app';

export let webhookApp = authedApp.use(async ctx => {
  let webhookRegistrationId = ctx.body.webhookRegistrationId;
  if (!webhookRegistrationId) throw new Error('Webhook Registration ID is required');

  let webhookRegistration = await slateWebhookRegistrationService.getGlobalWebhookRegistrationById(
    { id: webhookRegistrationId }
  );

  return { webhookRegistration };
});

export let webhookController = authedApp.controller({
  list: authedApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          slateIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateWebhookRegistrationService.listGlobalWebhookRegistrations({
        slateIds: ctx.input.slateIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateWebhookRegistrationPresenter);
    }),

  create: authedApp
    .handler()
    .input(
      v.object({
        slateId: v.string(),

        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),

        userConfig: v.record(v.any())
      })
    )
    .do(async ctx => {
      let res = await slateWebhookRegistrationService.createGlobalWebhookRegistration({
        input: {
          slateId: ctx.input.slateId,
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          userConfig: ctx.input.userConfig
        }
      });

      return slateWebhookRegistrationPresenter(res);
    }),

  get: webhookApp
    .handler()
    .input(
      v.object({
        webhookRegistrationId: v.string()
      })
    )
    .do(async ctx => slateWebhookRegistrationPresenter(ctx.webhookRegistration)),

  update: webhookApp
    .handler()
    .input(
      v.object({
        webhookRegistrationId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let res = await slateWebhookRegistrationService.updateGlobalWebhookRegistration({
        registration: ctx.webhookRegistration,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata
        }
      });

      return slateWebhookRegistrationPresenter(res);
    }),

  delete: webhookApp
    .handler()
    .input(
      v.object({
        webhookRegistrationId: v.string()
      })
    )
    .do(async ctx => {
      await slateWebhookRegistrationService.deleteGlobalWebhookRegistration({
        registration: ctx.webhookRegistration
      });

      return { success: true };
    })
});
