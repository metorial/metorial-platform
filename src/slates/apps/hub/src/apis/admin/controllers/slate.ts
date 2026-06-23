import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { slatePresenter } from '../../../presenters';
import { slateService } from '../../../services';
import { authedApp } from './_app';

export let slateApp = authedApp.use(async ctx => {
  let slateId = ctx.body.slateId;
  if (!slateId) throw new Error('Slate ID is required');

  let slate = await slateService.getSlateById({
    id: slateId
  });

  return { slate };
});

export let slateController = authedApp.controller({
  list: authedApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          search: v.optional(v.string())
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateService.listSlates({
        search: ctx.input.search
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slatePresenter);
    }),

  get: slateApp
    .handler()
    .input(
      v.object({
        slateId: v.string()
      })
    )
    .do(async ctx => slatePresenter(ctx.slate)),

  getStats: slateApp
    .handler()
    .input(
      v.object({
        slateId: v.string()
      })
    )
    .do(async ctx => {
      let stats = await slateService.getSlateStats({
        slate: ctx.slate
      });

      return {
        object: 'slate.stats',
        slateId: ctx.slate.id,
        ...stats
      };
    })
});
