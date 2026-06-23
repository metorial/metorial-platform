import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { containerRegistryPresenter } from '../../presenters';
import { containerRegistryService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let containerRegistryApp = tenantApp.use(async ctx => {
  let registryId = ctx.body.registryId;
  if (!registryId) throw new Error('registryId is required');

  let registry = await containerRegistryService.getRegistryById({
    tenant: ctx.tenant,
    registryId
  });

  return { registry };
});

export let containerRegistryController = app.controller({
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
      let paginator = await containerRegistryService.listRegistries({
        tenant: ctx.tenant
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, containerRegistryPresenter);
    }),

  get: containerRegistryApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        registryId: v.string()
      })
    )
    .do(async ctx => containerRegistryPresenter(ctx.registry))
});
