import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subRegistryPresenter } from '../../../presenters';
import { subRegistryService } from '../../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let subRegistryApp = tenantApp.use(async ctx => {
  let subRegistryId = ctx.body.subRegistryId;
  if (!subRegistryId) throw new Error('SubRegistry ID is required');

  let subRegistry = await subRegistryService.getSubRegistryById({
    id: subRegistryId,
    tenant: ctx.tenant
  });

  return { subRegistry };
});

export let subRegistryController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),

        name: v.string(),
        identifier: v.string()
      })
    )
    .do(async ctx => {
      let subRegistry = await subRegistryService.createSubRegistry({
        tenant: ctx.tenant,
        input: {
          name: ctx.input.name,
          identifier: ctx.input.identifier
        }
      });
      return subRegistryPresenter(subRegistry);
    }),

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
      let paginator = await subRegistryService.listSubRegistries({
        tenant: ctx.tenant
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, subRegistryPresenter);
    }),

  get: subRegistryApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        subRegistryId: v.string()
      })
    )
    .do(async ctx => subRegistryPresenter(ctx.subRegistry)),

  setFilters: subRegistryApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        subRegistryId: v.string(),
        filters: v.array(
          v.object({
            type: v.enumOf(['scope', 'prefix', 'package']),
            value: v.string()
          })
        )
      })
    )
    .do(async ctx => {
      let subRegistry = await subRegistryService.setFilters({
        subRegistry: ctx.subRegistry,
        filters: ctx.input.filters
      });
      return subRegistryPresenter(subRegistry);
    }),

  addFilter: subRegistryApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        subRegistryId: v.string(),
        type: v.enumOf(['scope', 'prefix', 'package']),
        value: v.string()
      })
    )
    .do(async ctx => {
      await subRegistryService.addFilter({
        subRegistry: ctx.subRegistry,
        input: {
          type: ctx.input.type,
          value: ctx.input.value
        }
      });
      let subRegistry = await subRegistryService.getSubRegistryById({
        id: ctx.subRegistry.id,
        tenant: ctx.tenant
      });
      return subRegistryPresenter(subRegistry);
    }),

  removeFilter: subRegistryApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        subRegistryId: v.string(),
        filterId: v.string()
      })
    )
    .do(async ctx => {
      await subRegistryService.removeFilter({
        subRegistry: ctx.subRegistry,
        filterId: ctx.input.filterId
      });
      let subRegistry = await subRegistryService.getSubRegistryById({
        id: ctx.subRegistry.id,
        tenant: ctx.tenant
      });
      return subRegistryPresenter(subRegistry);
    })
});
