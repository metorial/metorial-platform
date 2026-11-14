import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { containerRepositoryVersionPresenter } from '../../presenters';
import { containerRepositoryVersionService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let containerRepositoryVersionApp = tenantApp.use(async ctx => {
  let repositoryVersionId = ctx.body.repositoryVersionId;
  if (!repositoryVersionId) throw new Error('repositoryVersionId is required');

  let repositoryVersion = await containerRepositoryVersionService.getRepositoryVersionById({
    tenant: ctx.tenant,
    repositoryVersionId
  });

  return { repositoryVersion };
});

export let containerRepositoryVersionController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await containerRepositoryVersionService.listRepositoryVersions({
        tenant: ctx.tenant
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, containerRepositoryVersionPresenter);
    }),

  get: containerRepositoryVersionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        repositoryVersionId: v.string()
      })
    )
    .do(async ctx => containerRepositoryVersionPresenter(ctx.repositoryVersion))
});
