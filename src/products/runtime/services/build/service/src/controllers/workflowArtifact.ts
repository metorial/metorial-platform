import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { workflowArtifactPresenter } from '../presenters';
import { workflowArtifactService } from '../services';
import { app } from './_app';
import { workflowApp } from './workflow';

export let workflowArtifactApp = workflowApp.use(async ctx => {
  let workflowArtifactId = ctx.body.workflowArtifactId;
  if (!workflowArtifactId) throw new Error('Workflow Artifact ID is required');

  let artifact = await workflowArtifactService.getWorkflowArtifactById({
    id: workflowArtifactId,
    workflow: ctx.workflow
  });

  return { artifact };
});

export let workflowArtifactController = app.controller({
  list: workflowApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          workflowId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await workflowArtifactService.listWorkflowArtifacts({
        workflow: ctx.workflow
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, workflowArtifactPresenter);
    }),

  get: workflowArtifactApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        workflowId: v.string(),
        workflowArtifactId: v.string()
      })
    )
    .do(async ctx => workflowArtifactPresenter(ctx.artifact))
});
