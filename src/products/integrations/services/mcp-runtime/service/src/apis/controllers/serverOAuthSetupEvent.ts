import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { serverOAuthSetupEventPresenter } from '../../presenters';
import { serverOAuthSetupEventService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let serverOAuthSetupEventController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          serverOAuthSetupIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await serverOAuthSetupEventService.listServerOAuthSetupEvents({
        tenant: ctx.tenant,
        serverOAuthSetupIds: ctx.input.serverOAuthSetupIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, serverOAuthSetupEventPresenter);
    }),

  listSync: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          serverOAuthSetupIds: v.optional(v.array(v.string())),
          types: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await serverOAuthSetupEventService.listServerOAuthSetupEventsGlobal({
        serverOAuthSetupIds: ctx.input.serverOAuthSetupIds,
        types: ctx.input.types
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, serverOAuthSetupEventPresenter);
    })
});
