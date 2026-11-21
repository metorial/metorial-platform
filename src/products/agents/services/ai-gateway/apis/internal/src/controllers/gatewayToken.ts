import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { gatewayTokenService } from '@mtsrc/ai-gateway-module-access';
import { instanceService } from '@mtsrc/ai-gateway-module-scope';
import { gatewayTokenLimitsSchema, gatewayTokenMetadataSchema } from '@mtsrc/ai-gateway-spec';
import { gatewayTokenPresenter } from '../presenters/gatewayToken';
import { app, instanceApp, organizationApp } from './_app';

let allowedModelsSchema = v.array(
  v.string({ modifiers: [v.minLength(1), v.maxLength(200)] }),
  {
    modifiers: [v.maxLength(200)]
  }
);

export let gatewayTokenController = app.controller({
  create: instanceApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        instanceId: v.string(),

        name: v.string({ modifiers: [v.minLength(1)] }),
        consumerRef: v.optional(v.string()),

        allowedModels: v.optional(allowedModelsSchema),
        limits: v.optional(gatewayTokenLimitsSchema),
        metadata: v.optional(gatewayTokenMetadataSchema),

        expiresAt: v.optional(v.date())
      })
    )
    .do(async ctx => {
      let { gatewayToken, secret } = await gatewayTokenService.createGatewayToken({
        organization: ctx.organization,
        instance: ctx.instance,
        input: {
          name: ctx.input.name,
          consumerRef: ctx.input.consumerRef,
          allowedModels: ctx.input.allowedModels,
          limits: ctx.input.limits,
          metadata: ctx.input.metadata,
          expiresAt: ctx.input.expiresAt
        }
      });

      return { ...gatewayTokenPresenter(gatewayToken), secret };
    }),

  get: organizationApp
    .handler()
    .input(v.object({ organizationId: v.string(), gatewayTokenId: v.string() }))
    .do(async ctx => {
      let gatewayToken = await gatewayTokenService.getGatewayTokenById({
        organization: ctx.organization,
        gatewayTokenId: ctx.input.gatewayTokenId
      });

      return gatewayTokenPresenter(gatewayToken);
    }),

  list: organizationApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          organizationId: v.string(),
          instanceId: v.optional(v.string()),
          consumerRef: v.optional(v.string())
        })
      )
    )
    .do(async ctx => {
      let instance = ctx.input.instanceId
        ? await instanceService.getInstanceById({
            organization: ctx.organization,
            instanceId: ctx.input.instanceId,
            includeArchived: true
          })
        : undefined;

      let paginator = await gatewayTokenService.listGatewayTokens({
        organization: ctx.organization,
        instance,
        consumerRef: ctx.input.consumerRef
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, gatewayTokenPresenter);
    }),

  update: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        gatewayTokenId: v.string(),

        name: v.optional(v.string({ modifiers: [v.minLength(1)] })),
        allowedModels: v.optional(allowedModelsSchema),
        limits: v.optional(gatewayTokenLimitsSchema),
        metadata: v.optional(gatewayTokenMetadataSchema),

        expiresAt: v.optional(v.nullable(v.date()))
      })
    )
    .do(async ctx => {
      let gatewayToken = await gatewayTokenService.getGatewayTokenById({
        organization: ctx.organization,
        gatewayTokenId: ctx.input.gatewayTokenId
      });

      let updated = await gatewayTokenService.updateGatewayToken({
        gatewayToken,
        input: {
          name: ctx.input.name,
          allowedModels: ctx.input.allowedModels,
          limits: ctx.input.limits,
          metadata: ctx.input.metadata,
          expiresAt: ctx.input.expiresAt
        }
      });

      return gatewayTokenPresenter(updated);
    }),

  revoke: organizationApp
    .handler()
    .input(v.object({ organizationId: v.string(), gatewayTokenId: v.string() }))
    .do(async ctx => {
      let gatewayToken = await gatewayTokenService.getGatewayTokenById({
        organization: ctx.organization,
        gatewayTokenId: ctx.input.gatewayTokenId
      });

      let revoked = await gatewayTokenService.revokeGatewayToken({ gatewayToken });

      return gatewayTokenPresenter(revoked);
    })
});
