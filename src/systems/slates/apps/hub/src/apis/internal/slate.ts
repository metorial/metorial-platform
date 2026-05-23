import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { slatePresenter } from '../../presenters';
import { slateService } from '../../services';
import { app } from './_app';

export let slateApp = app.use(async ctx => {
  let slateId = ctx.body.slateId;
  if (!slateId) throw new Error('Slate ID is required');

  let slate = await slateService.getSlateById({
    id: slateId
  });

  return { slate };
});

export let slateController = app.controller({
  list: app
    .handler()
    .input(Paginator.validate(v.object({})))
    .do(async ctx => {
      let paginator = await slateService.listSlates({});

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

  getRegistryRecord: slateApp
    .handler()
    .input(
      v.object({
        slateId: v.string()
      })
    )
    .do(
      async ctx =>
        await slateService.getSlateRegistryRecord({
          slate: ctx.slate
        })
    ),

  getMany: app
    .handler()
    .input(
      v.object({
        slateIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let slates = await slateService.getManySlatesByIds({
        ids: ctx.input.slateIds
      });

      return slates.map(slatePresenter);
    }),

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
