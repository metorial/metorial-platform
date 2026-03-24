import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { slateSpecificationChangePresenter } from '../../presenters';
import { slateSpecificationChangeService } from '../../services';
import { app } from './_app';

export let slateSpecificationChangeApp = app.use(async ctx => {
  let slateSpecificationChangeId = ctx.body.slateSpecificationChangeId;
  if (!slateSpecificationChangeId) throw new Error('Slate SpecificationChange ID is required');

  let slateSpecificationChange =
    await slateSpecificationChangeService.getSlateSpecificationChangeById({
      id: slateSpecificationChangeId
    });

  return { slateSpecificationChange };
});

export let slateSpecificationChangeController = app.controller({
  list: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          slateIds: v.optional(v.array(v.string())),
          versionIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateSpecificationChangeService.listSlateSpecificationChanges({
        slateIds: ctx.input.slateIds,
        versionIds: ctx.input.versionIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateSpecificationChangePresenter);
    }),

  get: slateSpecificationChangeApp
    .handler()
    .input(
      v.object({
        slateSpecificationChangeId: v.string()
      })
    )
    .do(async ctx => slateSpecificationChangePresenter(ctx.slateSpecificationChange)),

  getMany: app
    .handler()
    .input(
      v.object({
        slateSpecificationChangeIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let slateSpecificationChanges =
        await slateSpecificationChangeService.getManySlateSpecificationChangesByIds({
          ids: ctx.input.slateSpecificationChangeIds
        });

      return slateSpecificationChanges.map(slateSpecificationChangePresenter);
    })
});
