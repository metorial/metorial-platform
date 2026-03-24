import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { slateEventPresenter } from '../../presenters';
import { slateEventService, slateService } from '../../services';
import { app } from './_app';
import { slateApp } from './slate';

export let slateEventApp = slateApp.use(async ctx => {
  let slateEventId = ctx.body.slateEventId;
  if (!slateEventId) throw new Error('Slate Event ID is required');

  let slateEvent = await slateEventService.getSlateEventById({
    id: slateEventId,
    slate: ctx.slate
  });

  return { slateEvent };
});

export let slateEventController = app.controller({
  list: app
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
    }),

  get: slateEventApp
    .handler()
    .input(
      v.object({
        slateId: v.string(),
        slateEventId: v.string()
      })
    )
    .do(async ctx => slateEventPresenter(ctx.slateEvent))
});
