import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { slateOAuthSetupEventPresenter } from '../../presenters/slateOAuthSetupEvent';
import { slateOAuthSetupEventService } from '../../services/slateOAuthSetupEvent';
import { app } from './_app';
import { tenantApp } from './tenant';

export let slateOAuthSetupEventController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          slateOAuthSetupIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateOAuthSetupEventService.listSlateOAuthSetupEvents({
        tenant: ctx.tenant,
        slateOAuthSetupIds: ctx.input.slateOAuthSetupIds
      });

      let list = await paginator.run(ctx.input);

      return await Paginator.presentLight(list, slateOAuthSetupEventPresenter);
    }),

  listSync: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          slateOAuthSetupIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateOAuthSetupEventService.listSlateOAuthSetupEventsGlobal({
        slateOAuthSetupIds: ctx.input.slateOAuthSetupIds
      });

      let list = await paginator.run(ctx.input);

      return await Paginator.presentLight(list, slateOAuthSetupEventPresenter);
    })
});
