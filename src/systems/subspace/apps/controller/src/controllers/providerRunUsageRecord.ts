import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { providerRunUsageRecordService } from '@metorial-subspace/module-session';
import { providerRunUsageRecordPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantOptionalWithoutEnvironmentApp } from './tenant';

export let providerRunUsageRecordController = app.controller({
  list: tenantOptionalWithoutEnvironmentApp
    .handler()
    .input(Paginator.validate(v.object({ tenantId: v.optional(v.string()) })))
    .do(async ctx => {
      let paginator = await providerRunUsageRecordService.listProviderRunUsageRecords({
        ...ctx.input,
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, v => providerRunUsageRecordPresenter(v));
    })
});
