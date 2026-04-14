import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { workflowVersionPresenter } from '../presenters';
import { workflowVersionService } from '../services';
import { app } from './_app';
import { workflowApp } from './workflow';

export let workflowVersionApp = workflowApp.use(async ctx => {
  let workflowVersionId = ctx.body.workflowVersionId;
  if (!workflowVersionId) throw new Error('Workflow Version ID is required');

  let version = await workflowVersionService.getWorkflowVersionById({
    id: workflowVersionId,
    workflow: ctx.workflow
  });

  return { version };
});

export let workflowVersionController = app.controller({
  create: workflowApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        workflowId: v.string(),

        name: v.string(),

        steps: v.array(
          v.union([
            v.object({
              name: v.string(),
              type: v.literal('script'),
              initScript: v.optional(v.array(v.string())),
              actionScript: v.array(v.string()),
              cleanupScript: v.optional(v.array(v.string()))
            }),
            v.object({
              name: v.string(),
              type: v.literal('download_artifact'),
              artifactId: v.string(),
              artifactDestinationPath: v.string()
            }),
            v.object({
              name: v.string(),
              type: v.literal('upload_artifact'),
              artifactSourcePath: v.string(),
              artifactName: v.string()
            })
          ])
        )
      })
    )
    .do(async ctx => {
      let version = await workflowVersionService.createWorkflowVersion({
        workflow: ctx.workflow,
        input: {
          name: ctx.input.name,
          steps: ctx.input.steps
        }
      });
      return workflowVersionPresenter(version);
    }),

  list: workflowApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          workflowId: v.string(),
          tenantId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await workflowVersionService.listWorkflowVersions({
        workflow: ctx.workflow
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, workflowVersionPresenter);
    }),

  get: workflowVersionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        workflowId: v.string(),
        workflowVersionId: v.string()
      })
    )
    .do(async ctx => workflowVersionPresenter(ctx.version))
});
