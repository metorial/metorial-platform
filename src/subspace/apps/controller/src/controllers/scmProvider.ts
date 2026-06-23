import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  scmProviderPresenter,
  scmProviderService
} from '@metorial-subspace/module-custom-provider';
import { app } from './_app';
import { tenantApp } from './tenant';

export let scmProviderApp = tenantApp.use(async ctx => {
  let scmProviderId = ctx.body.scmProviderId;
  if (!scmProviderId) throw new Error('ScmProvider ID is required');

  let scmProvider = await scmProviderService.getScmProviderById({
    scmProviderId,
    tenant: ctx.tenant
  });

  return { scmProvider };
});

export let scmProviderController = app.controller({
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
      let paginator = await scmProviderService.listScmProviders({
        tenant: ctx.tenant,
        ...ctx.input
      });

      return {
        ...paginator,
        items: paginator.items.map(item => scmProviderPresenter(item))
      };
    }),

  get: scmProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        scmProviderId: v.string()
      })
    )
    .do(async ctx => scmProviderPresenter(ctx.scmProvider))
});
