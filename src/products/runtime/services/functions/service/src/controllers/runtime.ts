import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { runtimePresenter } from '../presenters';
import { runtimeService } from '../services';
import { app } from './_app';

export let runtimeController = app.controller({
  get: app
    .handler()
    .input(
      v.object({
        runtimeId: v.string()
      })
    )
    .do(async ctx => {
      let runtime = await runtimeService.getRuntimeById({ id: ctx.input.runtimeId });
      return runtimePresenter(runtime);
    }),

  list: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await runtimeService.listRuntimes();

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, runtimePresenter);
    })
});
