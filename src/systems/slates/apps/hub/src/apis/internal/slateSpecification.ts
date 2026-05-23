import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { slateSpecificationPresenter } from '../../presenters';
import { slateSpecificationService } from '../../services';
import { app } from './_app';

export let slateSpecificationApp = app.use(async ctx => {
  let slateSpecificationId = ctx.body.slateSpecificationId;
  if (!slateSpecificationId) throw new Error('Slate Specification ID is required');

  let slateSpecification = await slateSpecificationService.getSlateSpecificationById({
    id: slateSpecificationId
  });

  return { slateSpecification };
});

export let slateSpecificationController = app.controller({
  list: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          versionIds: v.optional(v.array(v.string())),
          slateIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateSpecificationService.listSlateSpecifications({
        versionIds: ctx.input.versionIds,
        slateIds: ctx.input.slateIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateSpecificationPresenter);
    }),

  get: slateSpecificationApp
    .handler()
    .input(
      v.object({
        slateSpecificationId: v.string()
      })
    )
    .do(async ctx => slateSpecificationPresenter(ctx.slateSpecification)),

  getMany: app
    .handler()
    .input(
      v.object({
        slateSpecificationIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let slateSpecifications =
        await slateSpecificationService.getManySlateSpecificationsByIds({
          ids: ctx.input.slateSpecificationIds
        });

      return slateSpecifications.map(slateSpecificationPresenter);
    })
});
