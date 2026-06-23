import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { scmRepositoryPushPresenter } from '../presenters/scmRepositoryPush';
import { scmRepoPushService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let scmRepoPushApp = tenantApp.use(async ctx => {
  let scmRepoPushId = ctx.body.scmRepoPushId;
  if (!scmRepoPushId) throw new Error('SCM Repository Push ID is required');

  let scmRepoPush = await scmRepoPushService.getScmRepoPushById({
    tenant: ctx.tenant,
    scmRepoPushId
  });

  return { scmRepoPush };
});

export let scmRepoPushController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          repoId: v.optional(v.string())
        })
      )
    )
    .do(async ctx => {
      let paginator = await scmRepoPushService.listScmRepoPushes({
        tenant: ctx.tenant,
        repoId: ctx.input.repoId
      });

      let pushes = await paginator.run(ctx.input);

      return Paginator.presentLight(pushes, scmRepositoryPushPresenter);
    }),

  get: scmRepoPushApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        scmRepoPushId: v.string()
      })
    )
    .do(async ctx => scmRepositoryPushPresenter(ctx.scmRepoPush))
});
