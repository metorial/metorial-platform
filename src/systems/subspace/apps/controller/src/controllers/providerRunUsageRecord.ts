import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerRunUsageRecordService } from '@metorial-subspace/module-session';
import { providerRunUsageRecordPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';

export let providerRunUsageRecordController = app.controller({
  list: app
    .handler()
    .input(Paginator.validate(v.object({})))
    .do(async ctx => {
      let paginator = await providerRunUsageRecordService.listProviderRunUsageRecords({
        ...ctx.input,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, v => providerRunUsageRecordPresenter(v));
    })
});
