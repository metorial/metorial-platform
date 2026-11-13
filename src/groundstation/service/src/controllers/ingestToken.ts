import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  contentPolicySchema,
  ingestChannels,
  ingestDeviceModes,
  ingestTagsSchema,
  ingestTokenLimitsSchema
} from '@metorial/groundstation-spec';
import { ingestTokenPresenter } from '../presenters';
import { ingestTokenService, instanceService } from '../services';
import { app, instanceApp, organizationApp } from './_app';

export let ingestTokenController = app.controller({
  create: instanceApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        instanceId: v.string(),

        name: v.string(),

        userRef: v.string(),
        deviceRef: v.optional(v.string()),
        deviceMode: v.optional(v.enumOf(ingestDeviceModes)),
        agentRef: v.optional(v.string()),
        tags: v.optional(ingestTagsSchema),

        contentPolicy: v.optional(contentPolicySchema),
        limits: v.optional(ingestTokenLimitsSchema),
        allowedClients: v.optional(v.array(v.string())),
        allowedChannels: v.optional(v.array(v.enumOf(ingestChannels))),

        expiresAt: v.optional(v.date())
      })
    )
    .do(async ctx => {
      let { ingestToken, secret } = await ingestTokenService.createIngestToken({
        organization: ctx.organization,
        instance: ctx.instance,
        input: {
          name: ctx.input.name,
          userRef: ctx.input.userRef,
          deviceRef: ctx.input.deviceRef,
          deviceMode: ctx.input.deviceMode,
          agentRef: ctx.input.agentRef,
          tags: ctx.input.tags,
          contentPolicy: ctx.input.contentPolicy,
          limits: ctx.input.limits,
          allowedClients: ctx.input.allowedClients,
          allowedChannels: ctx.input.allowedChannels,
          expiresAt: ctx.input.expiresAt
        }
      });

      return { ...ingestTokenPresenter(ingestToken), secret };
    }),

  get: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        ingestTokenId: v.string()
      })
    )
    .do(async ctx => {
      let ingestToken = await ingestTokenService.getIngestTokenById({
        organization: ctx.organization,
        ingestTokenId: ctx.input.ingestTokenId
      });

      return ingestTokenPresenter(ingestToken);
    }),

  list: organizationApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          organizationId: v.string(),
          instanceId: v.optional(v.string())
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

      let paginator = await ingestTokenService.listIngestTokens({
        organization: ctx.organization,
        instance
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, ingestToken => ingestTokenPresenter(ingestToken));
    }),

  update: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        ingestTokenId: v.string(),

        name: v.optional(v.string()),

        contentPolicy: v.optional(contentPolicySchema),
        limits: v.optional(ingestTokenLimitsSchema),
        allowedClients: v.optional(v.array(v.string())),
        allowedChannels: v.optional(v.array(v.enumOf(ingestChannels))),

        expiresAt: v.optional(v.nullable(v.date()))
      })
    )
    .do(async ctx => {
      let ingestToken = await ingestTokenService.getIngestTokenById({
        organization: ctx.organization,
        ingestTokenId: ctx.input.ingestTokenId
      });

      let updated = await ingestTokenService.updateIngestToken({
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

      return ingestTokenPresenter(updated);
    }),

  revoke: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        ingestTokenId: v.string()
      })
    )
    .do(async ctx => {
      let ingestToken = await ingestTokenService.getIngestTokenById({
        organization: ctx.organization,
        ingestTokenId: ctx.input.ingestTokenId
      });

      let revoked = await ingestTokenService.revokeIngestToken({ ingestToken });

      return ingestTokenPresenter(revoked);
    })
});
