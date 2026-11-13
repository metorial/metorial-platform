import { v } from '@lowerdeck/validation';
import { projectPresenter } from './presenters/project';
import { organizationService, projectService } from '@mtsrc/agent-tracking-module-scope';
import { scopeErasureService } from '@mtsrc/agent-tracking-module-erasure';
import { app, organizationApp } from './_app';

let retentionDays = () => v.optional(v.number({ modifiers: [v.positive(), v.integer()] }));

export let projectController = app.controller({
  upsert: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        ref: v.string({ modifiers: [v.minLength(1)] }),
        name: v.optional(v.nullable(v.string())),

        recordRetentionDays: retentionDays(),
        contentRetentionDays: retentionDays(),
        usageRetentionDays: retentionDays()
      })
    )
    .do(async ctx => {
      let project = await projectService.upsertProject({
        organization: ctx.organization,
        input: {
          ref: ctx.input.ref,
          name: ctx.input.name,
          recordRetentionDays: ctx.input.recordRetentionDays,
          contentRetentionDays: ctx.input.contentRetentionDays,
          usageRetentionDays: ctx.input.usageRetentionDays
        }
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

      project = await projectService.archiveProject({ project });

      return projectPresenter(project, ctx.organization);
    }),

  erase: app
    .handler()
    .input(v.object({ organizationId: v.string(), projectId: v.string() }))
    .do(async ctx => {
      let organization = await organizationService.getOrganizationById({
        organizationId: ctx.input.organizationId,
        includeArchived: true
      });
      let project = await projectService.getProjectById({
        organization,
        projectId: ctx.input.projectId,
        includeArchived: true
      });

      await scopeErasureService.eraseProject({ organization, project });

      return { projectId: project.id, erasing: true };
    })
});
