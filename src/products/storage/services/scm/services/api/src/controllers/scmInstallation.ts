import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { scmInstallationPresenter } from '../presenters/scmInstallation';
import { actorService, scmInstallationService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let scmInstallationApp = tenantApp.use(async ctx => {
  let scmInstallationId = ctx.body.scmInstallationId;
  if (!scmInstallationId) throw new Error('SCM Installation ID is required');

  let scmInstallation = await scmInstallationService.getScmInstallationById({
    tenant: ctx.tenant,
    scmInstallationId
  });

  return { scmInstallation };
});

export let scmInstallationController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          actorId: v.string()
        })
      )
    )
    .do(async ctx => {
      let actor = await actorService.getActorById({ id: ctx.input.actorId });

      let paginator = await scmInstallationService.listScmInstallations({
        tenant: ctx.tenant,
        actor
      });

      let installations = await paginator.run(ctx.input);

      return Paginator.presentLight(installations, scmInstallationPresenter);
    }),

  get: scmInstallationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        scmInstallationId: v.string()
      })
    )
    .do(async ctx => scmInstallationPresenter(ctx.scmInstallation))
});
