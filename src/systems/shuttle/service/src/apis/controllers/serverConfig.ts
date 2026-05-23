import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { serverConfigPresenter } from '../../presenters';
import { serverConfigService, serverService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let serverConfigApp = tenantApp.use(async ctx => {
  let serverConfigId = ctx.body.serverConfigId;
  if (!serverConfigId) throw new Error('serverConfigId is required');

  let serverConfig = await serverConfigService.getServerConfigById({
    tenant: ctx.tenant,
    serverConfigId
  });

  return { serverConfig };
});

export let serverConfigController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await serverConfigService.listServerConfigs({
        tenant: ctx.tenant
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, serverConfigPresenter);
    }),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),

        serverId: v.string(),

        config: v.record(v.any())
      })
    )
    .do(async ctx => {
      let server = await serverService.getServerById({
        tenant: ctx.tenant,
        serverId: ctx.input.serverId
      });

      let res = await serverConfigService.createServerConfig({
        tenant: ctx.tenant,

        input: {
          server,
          config: ctx.input.config
        }
      });

      return serverConfigPresenter(res);
    }),

  get: serverConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverConfigId: v.string()
      })
    )
    .do(async ctx => serverConfigPresenter(ctx.serverConfig)),

  delete: serverConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverConfigId: v.string()
      })
    )
    .do(async ctx => {
      await serverConfigService.deleteServerConfig({
        tenant: ctx.tenant,
        serverConfig: ctx.serverConfig
      });

      return { success: true };
    })
});
