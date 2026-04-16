import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { slateAuthConfigEventPresenter } from '../../presenters/slateAuthConfigEvent';
import { slateAuthConfigEventService } from '../../services/slateAuthConfigEvent';
import { app } from './_app';
import { tenantApp } from './tenant';

export let slateAuthConfigEventController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          authConfigIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateAuthConfigEventService.listSlateAuthConfigEvents({
        tenant: ctx.tenant,
        authConfigIds: ctx.input.authConfigIds
      });

      let list = await paginator.run(ctx.input);

      return await Paginator.presentLight(list, slateAuthConfigEventPresenter);
    })
});
