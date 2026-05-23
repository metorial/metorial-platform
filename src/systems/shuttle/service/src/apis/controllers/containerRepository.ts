import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { containerRepositoryPresenter } from '../../presenters';
import { containerRepositoryService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let containerRepositoryApp = tenantApp.use(async ctx => {
  let repositoryId = ctx.body.repositoryId;
  if (!repositoryId) throw new Error('repositoryId is required');

  let repository = await containerRepositoryService.getRepositoryById({
    tenant: ctx.tenant,
    repositoryId
  });

  return { repository };
});

export let containerRepositoryController = app.controller({
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
      let paginator = await containerRepositoryService.listRepositories({
        tenant: ctx.tenant
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, containerRepositoryPresenter);
    }),

  get: containerRepositoryApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        repositoryId: v.string()
      })
    )
    .do(async ctx => containerRepositoryPresenter(ctx.repository))
});
