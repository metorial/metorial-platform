import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  containerRegistryPresenter,
  containerRegistryService
} from '@metorial-subspace/provider-shuttle';
import { app } from './_app';
import { tenantApp } from './tenant';

export let containerRegistryApp = tenantApp.use(async ctx => {
  let containerRegistryId = ctx.body.containerRegistryId;
  if (!containerRegistryId) throw new Error('ContainerRegistry ID is required');

  let containerRegistry = await containerRegistryService.getContainerRegistryById({
    containerRegistryId,
    tenant: ctx.tenant
  });

  return { containerRegistry };
});

export let containerRegistryController = app.controller({
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
      let paginator = await containerRegistryService.listContainerRegistries({
        tenant: ctx.tenant,
        ...ctx.input
      });

      return {
        ...paginator,
        items: paginator.items.map(item => containerRegistryPresenter(item))
      };
    }),

  get: containerRegistryApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        containerRegistryId: v.string()
      })
    )
    .do(async ctx => containerRegistryPresenter(ctx.containerRegistry))
});
