import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
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
      let paginator = await assistantService.listAvailableAssistants({
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
        await assistantService.getAvailableAssistant({
          tenant: ctx.tenant,
          assistantId: ctx.input.assistantId
        })
      )
    )
});
