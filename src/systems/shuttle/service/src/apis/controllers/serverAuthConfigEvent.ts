import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { serverAuthConfigEventPresenter } from '../../presenters';
import { serverAuthConfigEventService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let serverAuthConfigEventApp = tenantApp.use(async ctx => {
  let serverAuthConfigEventId = ctx.body.serverAuthConfigEventId;
  if (!serverAuthConfigEventId) throw new Error('serverAuthConfigEventId is required');

  let serverAuthConfigEvent = await serverAuthConfigEventService.getServerAuthConfigEventById({
    tenant: ctx.tenant,
    serverAuthConfigEventId
  });

  return { serverAuthConfigEvent };
});

export let serverAuthConfigEventSyncApp = app.use(async ctx => {
  let serverAuthConfigEventId = ctx.body.serverAuthConfigEventId;
  if (!serverAuthConfigEventId) throw new Error('serverAuthConfigEventId is required');

  let serverAuthConfigEvent =
    await serverAuthConfigEventService.DANGEROUSLY_getServerAuthConfigEventById({
      serverAuthConfigEventId
    });

  return { serverAuthConfigEvent };
});

export let serverAuthConfigEventController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          serverAuthConfigIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await serverAuthConfigEventService.listServerAuthConfigEvents({
        tenant: ctx.tenant,
        serverAuthConfigIds: ctx.input.serverAuthConfigIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, serverAuthConfigEventPresenter);
    }),

  listSync: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          serverAuthConfigIds: v.optional(v.array(v.string())),
          types: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await serverAuthConfigEventService.listServerAuthConfigEventsGlobal({
        serverAuthConfigIds: ctx.input.serverAuthConfigIds,
        types: ctx.input.types
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, serverAuthConfigEventPresenter);
    }),

  get: serverAuthConfigEventApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverAuthConfigEventId: v.string()
      })
    )
    .do(async ctx => serverAuthConfigEventPresenter(ctx.serverAuthConfigEvent)),

  getSync: serverAuthConfigEventSyncApp
    .handler()
    .input(
      v.object({
        serverAuthConfigEventId: v.string()
      })
    )
    .do(async ctx => serverAuthConfigEventPresenter(ctx.serverAuthConfigEvent))
});
