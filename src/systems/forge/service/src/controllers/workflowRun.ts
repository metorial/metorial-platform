import { Paginator } from '@lowerdeck/pagination';
import { createValidator, v, type ValidatorOptions } from '@lowerdeck/validation';
import { workflowRunPresenter, workflowRunStepPresenter } from '../presenters';
import { workflowRunService } from '../services';
import { app } from './_app';
import { workflowApp } from './workflow';

export let workflowRunApp = workflowApp.use(async ctx => {
  let workflowRunId = ctx.body.workflowRunId;
  if (!workflowRunId) throw new Error('Workflow Run ID is required');

  let run = await workflowRunService.getWorkflowRunById({
    id: workflowRunId,
    workflow: ctx.workflow
  });

  return { run };
});

let longString = createValidator<string, ValidatorOptions<string>>('string', (opts, value) => {
  if (typeof value != 'string') {
    return {
      success: false,
      errors: [
        {
          code: 'invalid_type',
          message: opts.message ?? `Invalid input, expected string, received ${typeof value}`,
          received: typeof value,
          expected: 'string'
        }
      ]
    };
  }

  if (value.length > 50_000_000) {
    return {
      success: false,
      errors: [
        {
          code: 'max_length',
          message: 'Input is too long'
        }
      ]
    };
  }

  return { success: true, value };
});

export let workflowRunController = app.controller({
  create: workflowApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        workflowId: v.string(),

        env: v.record(v.string()),

        files: v.array(
          v.object({
            filename: v.string(),
            content: longString(),
            encoding: v.optional(v.enumOf(['utf-8', 'base64']))
          })
        )
      })
    )
    .do(async ctx => {
      let run = await workflowRunService.createWorkflowRun({
        workflow: ctx.workflow,
        input: {
          env: ctx.input.env,
          files: ctx.input.files
        }
      });

      return workflowRunPresenter(run);
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
      let paginator = await workflowRunService.listWorkflowRuns({
        workflow: ctx.workflow
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, workflowRunPresenter);
    }),

  get: workflowRunApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        workflowId: v.string(),
        workflowRunId: v.string()
      })
    )
    .do(async ctx => workflowRunPresenter(ctx.run)),

  getOutput: workflowRunApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        workflowId: v.string(),
        workflowRunId: v.string()
      })
    )
    .do(async ctx => {
      let output = await workflowRunService.getWorkflowRunOutput({ run: ctx.run });

      return output.map(o => ({
        ...o,
        step: workflowRunStepPresenter(o.step)
      }));
    }),

  getOutputForStep: workflowRunApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        workflowId: v.string(),
        workflowRunId: v.string(),
        workflowRunStepId: v.string()
      })
    )
    .do(
      async ctx =>
        await workflowRunService.getWorkflowRunOutputForStep({
          run: ctx.run,
          stepId: ctx.input.workflowRunStepId
        })
    )
});
