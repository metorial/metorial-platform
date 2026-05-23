import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { slateVersionPresenter } from '../../presenters';
import { slateVersionService } from '../../services';
import { app } from './_app';
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

export let slateVersionController = app.controller({
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
    .do(async ctx => slateVersionPresenter(ctx.slateVersion)),

  getRegistryRecord: slateVersionApp
    .handler()
    .input(
      v.object({
        slateId: v.string(),
        slateVersionId: v.string()
      })
    )
    .do(
      async ctx =>
        await slateVersionService.getSlateVersionRegistryRecord({
          slateVersion: ctx.slateVersion
        })
    ),

  getMany: app
    .handler()
    .input(
      v.object({
        slateVersionIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let slateVersions = await slateVersionService.getManySlateVersionsByIds({
        ids: ctx.input.slateVersionIds
      });

      return slateVersions.map(slateVersionPresenter);
    })
});
