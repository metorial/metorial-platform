import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { containerRepositoryTagPresenter } from '../../presenters';
import { containerRepositoryTagService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let containerRepositoryTagApp = tenantApp.use(async ctx => {
  let repositoryTagId = ctx.body.repositoryTagId;
  if (!repositoryTagId) throw new Error('repositoryTagId is required');

  let repositoryTag = await containerRepositoryTagService.getRepositoryTagById({
    tenant: ctx.tenant,
    repositoryTagId
  });

  return { repositoryTag };
});

export let containerRepositoryTagController = app.controller({
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
      let paginator = await containerRepositoryTagService.listRepositoryTags({
        tenant: ctx.tenant
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, containerRepositoryTagPresenter);
    }),

  get: containerRepositoryTagApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        repositoryTagId: v.string()
      })
    )
    .do(async ctx => containerRepositoryTagPresenter(ctx.repositoryTag))
});
