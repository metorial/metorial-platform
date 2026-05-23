import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { sessionUsageRecordService } from '@metorial-subspace/module-session';
import { sessionUsageRecordPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantOptionalWithoutEnvironmentApp } from './tenant';

export let sessionUsageRecordController = app.controller({
  list: tenantOptionalWithoutEnvironmentApp
    .handler()
    .input(Paginator.validate(v.object({ tenantId: v.optional(v.string()) })))
    .do(async ctx => {
      let paginator = await sessionUsageRecordService.listSessionUsageRecords({
        ...ctx.input,
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, v => sessionUsageRecordPresenter(v));
    })
});
