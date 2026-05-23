import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { slateVersionDiscoveryPresenter } from '../../presenters';
import { slateVersionDiscoveryService } from '../../services';
import { app } from './_app';
import { slateApp } from './slate';

export let slateVersionDiscoveryApp = slateApp.use(async ctx => {
  let slateVersionDiscoveryId = ctx.body.slateVersionDiscoveryId;
  if (!slateVersionDiscoveryId) throw new Error('Slate VersionDiscovery ID is required');

  let slateVersionDiscovery = await slateVersionDiscoveryService.getSlateVersionDiscoveryById({
    id: slateVersionDiscoveryId,
    slate: ctx.slate
  });

  return { slateVersionDiscovery };
});

export let slateVersionDiscoveryController = app.controller({
  list: slateApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          slateId: v.string(),
          versionIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateVersionDiscoveryService.listSlateVersionDiscoveries({
        slate: ctx.slate,
        versionIds: ctx.input.versionIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateVersionDiscoveryPresenter);
    }),

  get: slateVersionDiscoveryApp
    .handler()
    .input(
      v.object({
        slateId: v.string(),
        slateVersionDiscoveryId: v.string()
      })
    )
    .do(async ctx => slateVersionDiscoveryPresenter(ctx.slateVersionDiscovery))
});
