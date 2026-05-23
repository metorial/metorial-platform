import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { serverAuthConfigPresenter } from '../../presenters';
import { serverAuthConfigService, serverService } from '../../services';
import { serverAuthTokenService } from '../../services/oauth/serverAuthToken';
import { app } from './_app';
import { tenantApp } from './tenant';

export let serverAuthConfigApp = tenantApp.use(async ctx => {
  let serverAuthConfigId = ctx.body.serverAuthConfigId;
  if (!serverAuthConfigId) throw new Error('serverAuthConfigId is required');

  let serverAuthConfig = await serverAuthConfigService.getServerAuthConfigById({
    tenant: ctx.tenant,
    serverAuthConfigId
  });

  return { serverAuthConfig };
});

export let serverAuthConfigSyncApp = app.use(async ctx => {
  let serverAuthConfigId = ctx.body.serverAuthConfigId;
  if (!serverAuthConfigId) throw new Error('serverAuthConfigId is required');

  let serverAuthConfig = await serverAuthConfigService.DANGEROUSLY_getServerAuthConfigById({
    serverAuthConfigId
  });

  return { serverAuthConfig };
});

export let serverAuthConfigController = app.controller({
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
      let paginator = await serverAuthConfigService.listServerAuthConfigs({
        tenant: ctx.tenant
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, serverAuthConfigPresenter);
    }),

  listSync: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          serverAuthConfigIds: v.optional(v.array(v.string())),
          serverIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await serverAuthConfigService.listServerAuthConfigsGlobal({
        serverAuthConfigIds: ctx.input.serverAuthConfigIds,
        serverIds: ctx.input.serverIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, serverAuthConfigPresenter);
    }),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),

        serverId: v.string(),

        config: v.object({
          accessToken: v.string(),
          expiresAt: v.optional(v.nullable(v.string()))
        })
      })
    )
    .do(async ctx => {
      let server = await serverService.getServerById({
        tenant: ctx.tenant,
        serverId: ctx.input.serverId
      });

      let res = await serverAuthConfigService.createServerAuthConfig({
        tenant: ctx.tenant,
        input: {
          server,
          config: {
            accessToken: ctx.input.config.accessToken,
            expiresAt: ctx.input.config.expiresAt
              ? new Date(ctx.input.config.expiresAt)
              : undefined
          }
        }
      });

      return serverAuthConfigPresenter(res);
    }),

  decrypt: serverAuthConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverAuthConfigId: v.string(),
        note: v.string()
      })
    )
    .do(async ctx => {
      let decrypted = await serverAuthTokenService.useAuthToken({
        authConfig: ctx.serverAuthConfig,
        tenant: ctx.tenant
      });

      return {
        decryptedAuthConfig: {
          accessToken: decrypted.accessToken,
          expiresAt: decrypted.expiresAt
        },
        authConfig: serverAuthConfigPresenter(ctx.serverAuthConfig)
      };
    }),

  get: serverAuthConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverAuthConfigId: v.string()
      })
    )
    .do(async ctx => serverAuthConfigPresenter(ctx.serverAuthConfig)),

  getSync: serverAuthConfigSyncApp
    .handler()
    .input(
      v.object({
        serverAuthConfigId: v.string()
      })
    )
    .do(async ctx => serverAuthConfigPresenter(ctx.serverAuthConfig)),

  delete: serverAuthConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverAuthConfigId: v.string()
      })
    )
    .do(async ctx => {
      await serverAuthConfigService.deleteServerAuthConfig({
        tenant: ctx.tenant,
        serverAuthConfig: ctx.serverAuthConfig
      });

      return { success: true };
    })
});
