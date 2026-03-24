import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { SlateDeploymentStatus } from '../../../../prisma/generated/client';
import { slateDeploymentPresenter } from '../../../presenters';
import { slateDeploymentService, slateService } from '../../../services';
import { authedApp } from './_app';
import { slateApp } from './slate';

export let slateDeploymentApp = slateApp.use(async ctx => {
  let slateDeploymentId = ctx.body.slateDeploymentId;
  if (!slateDeploymentId) throw new Error('Slate Deployment ID is required');

  let slateDeployment = await slateDeploymentService.getSlateDeploymentById({
    id: slateDeploymentId,
    slate: ctx.slate
  });

  return { slateDeployment };
});

export let slateDeploymentController = authedApp.controller({
  list: authedApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          slateId: v.optional(v.string()),
          versionIds: v.optional(v.array(v.string())),
          status: v.optional(v.enumOf(Object.values(SlateDeploymentStatus) as [SlateDeploymentStatus, ...SlateDeploymentStatus[]]))
        })
      )
    )
    .do(async ctx => {
      let slate = ctx.input.slateId
        ? await slateService.getSlateById({ id: ctx.input.slateId })
        : undefined;

      let paginator = await slateDeploymentService.listSlateDeployments({
        slate,
        versionIds: ctx.input.versionIds,
        status: ctx.input.status
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateDeploymentPresenter);
    }),

  get: slateDeploymentApp
    .handler()
    .input(
      v.object({
        slateId: v.string(),
        slateDeploymentId: v.string()
      })
    )
    .do(async ctx => slateDeploymentPresenter(ctx.slateDeployment)),

  getBuildOutput: slateDeploymentApp
    .handler()
    .input(
      v.object({
        slateId: v.string(),
        slateDeploymentId: v.string()
      })
    )
    .do(async ctx => {
      let res = await slateDeploymentService.getBuildOutput({
        slateDeployment: ctx.slateDeployment
      });

      return res;
    }),

  getInternalLogs: slateDeploymentApp
    .handler()
    .input(
      v.object({
        slateId: v.string(),
        slateDeploymentId: v.string()
      })
    )
    .do(async ctx => {
      return slateDeploymentService.getInternalLogs({
        slateDeployment: ctx.slateDeployment
      });
    }),

  redeploy: slateDeploymentApp
    .handler()
    .input(
      v.object({
        slateId: v.string(),
        slateDeploymentId: v.string()
      })
    )
    .do(async ctx => {
      await slateDeploymentService.redeploy({
        slateDeployment: ctx.slateDeployment
      });
      return {};
    })
});
