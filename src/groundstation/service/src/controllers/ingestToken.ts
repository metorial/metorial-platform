import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { contentPolicySchema, ingestTokenLimitsSchema } from '@metorial/groundstation-spec';
import { ingestTokenPresenter } from '../presenters';
import { ingestTokenService } from '../services';
import { tenantApp } from './tenant';

export let ingestTokenController = tenantApp.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),

        name: v.string(),
        principalRef: v.optional(v.string()),

        contentPolicy: v.optional(contentPolicySchema),
        limits: v.optional(ingestTokenLimitsSchema),
        allowedClients: v.optional(v.array(v.string())),
        allowedChannels: v.optional(v.array(v.string())),

        expiresAt: v.optional(v.date())
      })
    )
    .do(async ctx => {
      let { ingestToken, secret } = await ingestTokenService.createIngestToken({
        tenant: ctx.tenant,
        input: {
          name: ctx.input.name,
          principalRef: ctx.input.principalRef,
          contentPolicy: ctx.input.contentPolicy,
          limits: ctx.input.limits,
          allowedClients: ctx.input.allowedClients,
          allowedChannels: ctx.input.allowedChannels,
          expiresAt: ctx.input.expiresAt
        }
      });

      return { ...ingestTokenPresenter(ingestToken), secret };
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        ingestTokenId: v.string()
      })
    )
    .do(async ctx => {
      let ingestToken = await ingestTokenService.getIngestTokenById({
        id: ctx.input.ingestTokenId,
        tenant: ctx.tenant
      });

      return ingestTokenPresenter(ingestToken);
    }),

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
      let paginator = await ingestTokenService.listIngestTokens({ tenant: ctx.tenant });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, i => ingestTokenPresenter(i));
    }),

  update: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        ingestTokenId: v.string(),

        name: v.optional(v.string()),

        contentPolicy: v.optional(contentPolicySchema),
        limits: v.optional(ingestTokenLimitsSchema),
        allowedClients: v.optional(v.array(v.string())),
        allowedChannels: v.optional(v.array(v.string())),

        expiresAt: v.optional(v.nullable(v.date()))
      })
    )
    .do(async ctx => {
      let ingestToken = await ingestTokenService.getIngestTokenById({
        id: ctx.input.ingestTokenId,
        tenant: ctx.tenant
      });

      ingestToken = await ingestTokenService.updateIngestToken({
        ingestToken,
        input: {
          name: ctx.input.name,
          contentPolicy: ctx.input.contentPolicy,
          limits: ctx.input.limits,
          allowedClients: ctx.input.allowedClients,
          allowedChannels: ctx.input.allowedChannels,
          expiresAt: ctx.input.expiresAt
        }
      });

      return ingestTokenPresenter(ingestToken);
    }),

  revoke: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        ingestTokenId: v.string()
      })
    )
    .do(async ctx => {
      let ingestToken = await ingestTokenService.getIngestTokenById({
        id: ctx.input.ingestTokenId,
        tenant: ctx.tenant
      });

      ingestToken = await ingestTokenService.revokeIngestToken({ ingestToken });

      return ingestTokenPresenter(ingestToken);
    })
});
