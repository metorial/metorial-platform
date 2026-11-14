import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import type { SlateWebhookRegistrationType } from '../../../prisma/generated/client';
import { slateWebhookRegistrationPresenter } from '../../presenters';
import { slateWebhookRegistrationService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

let setupTypes: SlateWebhookRegistrationType[] = ['manual', 'delivery_config'];

let maxOAuthCredentialsIds = 100;

export let slateWebhookRegistrationApp = tenantApp.use(async ctx => {
  let webhookRegistrationId = ctx.body.webhookRegistrationId;
  if (!webhookRegistrationId) throw new Error('Webhook Registration ID is required');

  let webhookRegistration = await slateWebhookRegistrationService.getWebhookRegistrationById({
    id: webhookRegistrationId,
    tenant: ctx.tenant,
    types: setupTypes
  });

  return { webhookRegistration };
});

export let slateWebhookRegistrationController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateWebhookRegistrationService.listWebhookRegistrations({
        tenant: ctx.tenant,
        types: setupTypes
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateWebhookRegistrationPresenter);
    }),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateId: v.string(),

        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),

        authRouting: v.optional(
          v.enumOf(['any', 'restricted_method', 'restricted_credential'])
        ),
        authMethodIds: v.optional(v.array(v.string())),
        slateOAuthCredentialsIds: v.optional(v.array(v.string())),
        deliveryConfigOAuthCredentialsId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let res = await slateWebhookRegistrationService.createManualWebhookSetup({
        tenant: ctx.tenant,
        input: {
          slateId: ctx.input.slateId,
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          authRouting: ctx.input.authRouting,
          authMethodIds: ctx.input.authMethodIds,
          slateOAuthCredentialsIds: ctx.input.slateOAuthCredentialsIds,
          deliveryConfigOAuthCredentialsId: ctx.input.deliveryConfigOAuthCredentialsId
        }
      });

      return {
        webhookRegistration: slateWebhookRegistrationPresenter(res.registration),
        webhookSetupDocument: res.webhookSetupDocument,
        webhookSetupSchema: res.userConfigSchema
      };
    }),

  setup: slateWebhookRegistrationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        webhookRegistrationId: v.string(),
        userConfig: v.record(v.any())
      })
    )
    .do(async ctx => {
      let res = await slateWebhookRegistrationService.finishManualWebhookSetup({
        tenant: ctx.tenant,
        registration: ctx.webhookRegistration,
        input: { userConfig: ctx.input.userConfig }
      });

      return slateWebhookRegistrationPresenter(res);
    }),

  get: slateWebhookRegistrationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        webhookRegistrationId: v.string()
      })
    )
    .do(async ctx => slateWebhookRegistrationPresenter(ctx.webhookRegistration)),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        webhookRegistrationIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let registrations =
        await slateWebhookRegistrationService.getManyWebhookRegistrationsByIds({
          tenant: ctx.tenant,
          ids: ctx.input.webhookRegistrationIds,
          types: setupTypes
        });

      return registrations.map(slateWebhookRegistrationPresenter);
    }),

  getDeliveryConfigsServingOAuthCredentials: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateOAuthCredentialsIds: v.array(v.string(), {
          modifiers: [v.maxLength(maxOAuthCredentialsIds)]
        })
      })
    )
    .do(async ctx => {
      let registrations =
        await slateWebhookRegistrationService.getDeliveryConfigsServingOAuthCredentials({
          tenant: ctx.tenant,
          oauthCredentialsIds: ctx.input.slateOAuthCredentialsIds
        });

      return registrations.map(slateWebhookRegistrationPresenter);
    }),

  update: slateWebhookRegistrationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        webhookRegistrationId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let res = await slateWebhookRegistrationService.updateWebhookRegistration({
        tenant: ctx.tenant,
        registration: ctx.webhookRegistration,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata
        }
      });

      return slateWebhookRegistrationPresenter(res);
    }),

  delete: slateWebhookRegistrationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        webhookRegistrationId: v.string()
      })
    )
    .do(async ctx => {
      await slateWebhookRegistrationService.deleteWebhookRegistration({
        tenant: ctx.tenant,
        registration: ctx.webhookRegistration
      });

      return { success: true };
    })
});
