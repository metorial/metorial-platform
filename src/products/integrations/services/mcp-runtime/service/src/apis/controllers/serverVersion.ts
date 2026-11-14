import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { serverVersionPresenter } from '../../presenters';
import { serverVersionService } from '../../services';
import { app } from './_app';
import { tenantApp, tenantOptionalApp } from './tenant';

export let serverVersionApp = tenantApp.use(async ctx => {
  let serverVersionId = ctx.body.serverVersionId;
  if (!serverVersionId) throw new Error('serverVersionId is required');

  let serverVersion = await serverVersionService.getServerVersionById({
    tenant: ctx.tenant,
    serverVersionId
  });

  return { serverVersion };
});

export let serverVersionController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          serverIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await serverVersionService.listServerVersions({
        tenant: ctx.tenant,
        serverIds: ctx.input.serverIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, serverVersionPresenter);
    }),

  get: serverVersionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverVersionId: v.string()
      })
    )
    .do(async ctx => serverVersionPresenter(ctx.serverVersion)),

  getMany: tenantOptionalApp
    .handler()
    .input(
      v.object({
        tenantId: v.optional(v.string()),
        serverVersionIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let serverVersions = await serverVersionService.getManyServerVersionsByIds({
        tenant: ctx.tenant,
        serverVersionIds: ctx.input.serverVersionIds
      });

      return serverVersions.map(serverVersionPresenter);
    })
});
