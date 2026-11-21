import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  instanceService,
  organizationService,
  projectService
} from '@mtsrc/ai-gateway-module-scope';
import { gatewayLimitsSchema, instanceSettingsSchema } from '@mtsrc/ai-gateway-spec';
import {
  instancePresenter,
  organizationPresenter,
  projectPresenter
} from '../presenters/scope';
import { app, instanceApp, organizationApp } from './_app';

export let organizationController = app.controller({
  upsert: app
    .handler()
    .input(
      v.object({
        ref: v.string({ modifiers: [v.minLength(1)] }),
        name: v.optional(v.nullable(v.string()))
      })
    )
    .do(async ctx => {
      let organization = await organizationService.upsertOrganization({
        input: { ref: ctx.input.ref, name: ctx.input.name }
      });

      return organizationPresenter(organization);
    }),

  get: organizationApp
    .handler()
    .input(v.object({ organizationId: v.string() }))
    .do(async ctx => organizationPresenter(ctx.organization)),

  archive: organizationApp
    .handler()
    .input(v.object({ organizationId: v.string() }))
    .do(async ctx => {
      let organization = await organizationService.archiveOrganization({
        organization: ctx.organization
      });

      return organizationPresenter(organization);
    })
});

export let projectController = app.controller({
  upsert: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        ref: v.string({ modifiers: [v.minLength(1)] }),
        name: v.optional(v.nullable(v.string()))
      })
    )
    .do(async ctx => {
      let project = await projectService.upsertProject({
        organization: ctx.organization,
        input: { ref: ctx.input.ref, name: ctx.input.name }
      });

      return projectPresenter(project, ctx.organization);
    }),

  get: organizationApp
    .handler()
    .input(v.object({ organizationId: v.string(), projectId: v.string() }))
    .do(async ctx => {
      let project = await projectService.getProjectById({
        organization: ctx.organization,
        projectId: ctx.input.projectId
      });

      return projectPresenter(project, ctx.organization);
    }),

  archive: organizationApp
    .handler()
    .input(v.object({ organizationId: v.string(), projectId: v.string() }))
    .do(async ctx => {
      let project = await projectService.getProjectById({
        organization: ctx.organization,
        projectId: ctx.input.projectId
      });

      project = await projectService.archiveProject({
        organization: ctx.organization,
        project
      });

      return projectPresenter(project, ctx.organization);
    })
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

        logRetentionDays: v.optional(
          v.number({ modifiers: [v.integer(), v.minValue(1), v.maxValue(400)] })
        ),
        settings: v.optional(instanceSettingsSchema),
        limits: v.optional(gatewayLimitsSchema)
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
          logRetentionDays: ctx.input.logRetentionDays,
          settings: ctx.input.settings,
          limits: ctx.input.limits
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
      let instance = await instanceService.archiveInstance({
        organization: ctx.organization,
        instance: ctx.instance
      });

      return instancePresenter(instance, ctx.organization);
    })
});
