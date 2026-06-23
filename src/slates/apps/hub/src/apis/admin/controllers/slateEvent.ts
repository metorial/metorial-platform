import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { slateEventPresenter } from '../../../presenters';
import { slateEventService, slateService } from '../../../services';
import { authedApp } from './_app';

export let slateEventController = authedApp.controller({
  list: authedApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          slateId: v.optional(v.string()),
          versionIds: v.optional(v.array(v.string())),
          type: v.optional(v.string())
        })
      )
    )
    .do(async ctx => {
      let slate = ctx.input.slateId
        ? await slateService.getSlateById({ id: ctx.input.slateId })
        : undefined;

      let paginator = await slateEventService.listSlateEvents({
        slate,
        versionIds: ctx.input.versionIds,
        type: ctx.input.type
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateEventPresenter);
    })
});
