import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { sessionUsageRecordService } from '@metorial-subspace/module-session';
import { sessionUsageRecordPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';

export let sessionUsageRecordController = app.controller({
  list: app
    .handler()
    .input(Paginator.validate(v.object({})))
    .do(async ctx => {
      let paginator = await sessionUsageRecordService.listSessionUsageRecords({
        ...ctx.input,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, v => sessionUsageRecordPresenter(v));
    })
});
