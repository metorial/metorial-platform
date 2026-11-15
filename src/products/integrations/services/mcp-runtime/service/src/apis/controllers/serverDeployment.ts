import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { serverDeploymentPresenter } from '../../presenters';
import { serverDeploymentService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let serverDeploymentApp = tenantApp.use(async ctx => {
  let serverDeploymentId = ctx.body.serverDeploymentId;
  if (!serverDeploymentId) throw new Error('serverDeploymentId is required');

  let serverDeployment = await serverDeploymentService.getServerDeploymentById({
    tenant: ctx.tenant,
    serverDeploymentId
  });

  return { serverDeployment };
});

export let serverDeploymentController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          serverIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await serverDeploymentService.listServerDeployments({
        tenant: ctx.tenant,
        serverIds: ctx.input.serverIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, serverDeploymentPresenter);
    }),

  get: serverDeploymentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverDeploymentId: v.string()
      })
    )
    .do(async ctx => serverDeploymentPresenter(ctx.serverDeployment)),

  getOutput: serverDeploymentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverDeploymentId: v.string()
      })
    )
    .do(async ctx => {
      let output = await serverDeploymentService.getServerDeploymentLogs({
        serverDeployment: ctx.serverDeployment
      });

      return output;
    })
});
