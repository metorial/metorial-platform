import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { instancePresenter } from '../presenters';
import { instanceService, organizationService, projectService } from '../services';
import { app, instanceApp, organizationApp } from './_app';

let positiveInteger = () => v.number({ modifiers: [v.positive(), v.integer()] });

let instanceSettingsSchema = v.object({
  ephemeralDeviceIdleDays: v.optional(positiveInteger()),
  inferredSessionGapMinutes: v.optional(positiveInteger()),
  classification: v.optional(
    v.object({
      enabled: v.optional(v.boolean()),
      threshold: v.optional(v.number({ modifiers: [v.minValue(0), v.maxValue(1)] })),
      ai: v.optional(
        v.object({
          enabled: v.optional(v.boolean()),
          model: v.optional(v.enumOf(['clef', 'clef-flash']))
        })
      )
    })
  )
});

export let instanceController = app.controller({
  upsert: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        projectId: v.string(),
        ref: v.string({ modifiers: [v.minLength(1)] }),
        name: v.optional(v.nullable(v.string())),

        skewBoundSeconds: v.optional(positiveInteger()),
        backfillMaxAgeDays: v.optional(v.nullable(positiveInteger())),
        settings: v.optional(instanceSettingsSchema)
      })
    )
    .do(async ctx => {
      let project = await projectService.getProjectById({
        organization: ctx.organization,
        projectId: ctx.input.projectId
      });

      let instance = await instanceService.upsertInstance({
        organization: ctx.organization,
        project,
        input: {
          ref: ctx.input.ref,
          name: ctx.input.name,
          skewBoundSeconds: ctx.input.skewBoundSeconds,
          backfillMaxAgeDays: ctx.input.backfillMaxAgeDays,
          settings: ctx.input.settings
        }
      });

      return instancePresenter(instance, ctx.organization);
    }),

  get: instanceApp
    .handler()
    .input(v.object({ organizationId: v.string(), instanceId: v.string() }))
    .do(async ctx => instancePresenter(ctx.instance, ctx.organization)),

  list: organizationApp
    .handler()
    .input(Paginator.validate(v.object({ organizationId: v.string(), projectId: v.string() })))
    .do(async ctx => {
      let project = await projectService.getProjectById({
        organization: ctx.organization,
        projectId: ctx.input.projectId
      });

      let paginator = await instanceService.listInstances({ project });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, instance =>
        instancePresenter(instance, ctx.organization)
      );
    }),

  archive: instanceApp
    .handler()
    .input(v.object({ organizationId: v.string(), instanceId: v.string() }))
    .do(async ctx => {
      let instance = await instanceService.archiveInstance({ instance: ctx.instance });

      return instancePresenter(instance, ctx.organization);
    }),

  erase: app
    .handler()
    .input(v.object({ organizationId: v.string(), instanceId: v.string() }))
    .do(async ctx => {
      let organization = await organizationService.getOrganizationById({
        organizationId: ctx.input.organizationId,
        includeArchived: true
      });
      let instance = await instanceService.getInstanceById({
        organization,
        instanceId: ctx.input.instanceId,
        includeArchived: true
      });

      await instanceService.eraseInstance({ organization, instance });

      return { instanceId: instance.id, erasing: true };
    })
});
