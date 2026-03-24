import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  containerRepositoryPresenter,
  containerRepositoryService
} from '@metorial-subspace/provider-shuttle';
import { app } from './_app';
import { tenantApp } from './tenant';

export let containerRepositoryApp = tenantApp.use(async ctx => {
  let containerRepositoryId = ctx.body.containerRepositoryId;
  if (!containerRepositoryId) throw new Error('ContainerRepository ID is required');

  let containerRepository = await containerRepositoryService.getContainerRepositoryById({
    containerRepositoryId,
    tenant: ctx.tenant
  });

  return { containerRepository };
});

export let containerRepositoryController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await containerRepositoryService.listContainerRepositories({
        tenant: ctx.tenant,
        ...ctx.input
      });

      return {
        ...paginator,
        items: paginator.items.map(item => containerRepositoryPresenter(item))
      };
    }),

  get: containerRepositoryApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        containerRepositoryId: v.string()
      })
    )
    .do(async ctx => containerRepositoryPresenter(ctx.containerRepository))
});
