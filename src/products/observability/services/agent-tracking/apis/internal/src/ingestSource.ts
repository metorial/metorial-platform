import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  contentPolicySchema,
  ingestChannels,
  ingestTagsSchema,
  ingestTokenLimitsSchema
} from '@mtsrc/agent-tracking-spec';
import { ingestSourcePresenter } from './presenters/ingestSource';
import { ingestSourceService } from '@mtsrc/agent-tracking-module-ingest-access';
import { instanceService } from '@mtsrc/agent-tracking-module-scope';
import { app, instanceApp, organizationApp } from './_app';

let newUserLimitSchema = () =>
  v.optional(v.number({ modifiers: [v.minValue(0), v.integer()] }));

let sourceTarget = v.object({
  organizationId: v.string(),
  ingestSourceId: v.string()
});

export let ingestSourceController = app.controller({
  create: instanceApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        instanceId: v.string(),

        name: v.string(),
        family: v.string({ modifiers: [v.minLength(1), v.maxLength(64)] }),
        tags: v.optional(ingestTagsSchema),

        contentPolicy: v.optional(contentPolicySchema),
        limits: v.optional(ingestTokenLimitsSchema),
        allowedChannels: v.optional(v.array(v.enumOf(ingestChannels))),
        newUserLimitPerDay: newUserLimitSchema()
      })
    )
    .do(async ctx => {
      let { ingestSource, secret } = await ingestSourceService.createIngestSource({
        organization: ctx.organization,
        instance: ctx.instance,
        input: {
          name: ctx.input.name,
          family: ctx.input.family,
          tags: ctx.input.tags,
          contentPolicy: ctx.input.contentPolicy,
          limits: ctx.input.limits,
          allowedChannels: ctx.input.allowedChannels,
          newUserLimitPerDay: ctx.input.newUserLimitPerDay
        }
      });

      return { ...ingestSourcePresenter(ingestSource), secret };
    }),

  get: organizationApp
    .handler()
    .input(sourceTarget)
    .do(async ctx => {
      let ingestSource = await ingestSourceService.getIngestSourceById({
        organization: ctx.organization,
        ingestSourceId: ctx.input.ingestSourceId
      });

      return ingestSourcePresenter(ingestSource);
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

      let paginator = await ingestSourceService.listIngestSources({
        organization: ctx.organization,
        instance
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, ingestSource => ingestSourcePresenter(ingestSource));
    }),

  update: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        ingestSourceId: v.string(),

        name: v.optional(v.string()),

        contentPolicy: v.optional(contentPolicySchema),
        limits: v.optional(ingestTokenLimitsSchema),
        allowedChannels: v.optional(v.array(v.enumOf(ingestChannels))),
        newUserLimitPerDay: newUserLimitSchema()
      })
    )
    .do(async ctx => {
      let ingestSource = await ingestSourceService.getIngestSourceById({
        organization: ctx.organization,
        ingestSourceId: ctx.input.ingestSourceId
      });

      let updated = await ingestSourceService.updateIngestSource({
        ingestSource,
        input: {
          name: ctx.input.name,
          contentPolicy: ctx.input.contentPolicy,
          limits: ctx.input.limits,
          allowedChannels: ctx.input.allowedChannels,
          newUserLimitPerDay: ctx.input.newUserLimitPerDay
        }
      });

      return ingestSourcePresenter(updated);
    }),

  rotate: organizationApp
    .handler()
    .input(sourceTarget)
    .do(async ctx => {
      let ingestSource = await ingestSourceService.getIngestSourceById({
        organization: ctx.organization,
        ingestSourceId: ctx.input.ingestSourceId
      });

      let rotated = await ingestSourceService.rotateIngestSource({ ingestSource });

      return { ...ingestSourcePresenter(rotated.ingestSource), secret: rotated.secret };
    }),

  revoke: organizationApp
    .handler()
    .input(sourceTarget)
    .do(async ctx => {
      let ingestSource = await ingestSourceService.getIngestSourceById({
        organization: ctx.organization,
        ingestSourceId: ctx.input.ingestSourceId
      });

      let revoked = await ingestSourceService.revokeIngestSource({ ingestSource });

      return ingestSourcePresenter(revoked);
    })
});
