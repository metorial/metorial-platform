import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { assistantPresenter } from '../presenters';
import { assistantService } from '../services';
import { app } from './_app';
import { tenantWithoutEnvironmentApp } from './tenant';

export let assistantController = app.controller({
  list: tenantWithoutEnvironmentApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await assistantService.list({
        tenant: ctx.tenant
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, assistantPresenter);
    }),

  get: tenantWithoutEnvironmentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        assistantId: v.string()
      })
    )
    .do(async ctx =>
      assistantPresenter(
        await assistantService.get({
          tenant: ctx.tenant,
          assistantId: ctx.input.assistantId
        })
      )
    ),

  getMany: tenantWithoutEnvironmentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        assistantIds: v.array(v.string())
      })
    )
    .do(async ctx =>
      (
        await assistantService.getMany({
          tenant: ctx.tenant,
          assistantIds: ctx.input.assistantIds
        })
      ).map(assistantPresenter)
    )
});
