import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { slateVersionPresenter } from '../../../presenters';
import { slateVersionService } from '../../../services';
import { authedApp } from './_app';
import { slateApp } from './slate';

export let slateVersionApp = slateApp.use(async ctx => {
  let slateVersionId = ctx.body.slateVersionId;
  if (!slateVersionId) throw new Error('Slate Version ID is required');

  let slateVersion = await slateVersionService.getSlateVersionById({
    id: slateVersionId,
    slate: ctx.slate
  });

  return { slateVersion };
});

export let slateVersionController = authedApp.controller({
  list: slateApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          slateId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateVersionService.listSlateVersions({
        slate: ctx.slate
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateVersionPresenter);
    }),

  get: slateVersionApp
    .handler()
    .input(
      v.object({
        slateId: v.string(),
        slateVersionId: v.string()
      })
    )
    .do(async ctx => slateVersionPresenter(ctx.slateVersion))
});
