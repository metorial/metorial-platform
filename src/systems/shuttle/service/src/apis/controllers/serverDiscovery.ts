import { v } from '@lowerdeck/validation';
import { serverDiscoveryPresenter } from '../../presenters/serverDiscovery';
import {
  serverAuthConfigService,
  serverConfigService,
  serverDiscoveryService,
  serverVersionService
} from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let serverDiscoveryController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),

        serverConfigId: v.string(),
        serverVersionId: v.string(),
        serverAuthConfigId: v.optional(v.string()),

        waitForCompletion: v.optional(v.boolean()) // true by default
      })
    )
    .do(async ctx => {
      let serverConfig = await serverConfigService.getServerConfigById({
        tenant: ctx.tenant,
        serverConfigId: ctx.input.serverConfigId
      });
      let serverVersion = await serverVersionService.getServerVersionById({
        tenant: ctx.tenant,
        serverVersionId: ctx.input.serverVersionId
      });
      let serverAuthConfig = ctx.input.serverAuthConfigId
        ? await serverAuthConfigService.getServerAuthConfigById({
            tenant: ctx.tenant,
            serverAuthConfigId: ctx.input.serverAuthConfigId
          })
        : undefined;

      let serverDiscovery = await serverDiscoveryService.createServerDiscovery({
        tenant: ctx.tenant,
        input: {
          serverConfig,
          serverVersion,
          serverAuthConfig
        }
      });

      if (ctx.input.waitForCompletion === false) {
        return serverDiscoveryPresenter(serverDiscovery);
      }

      let res = await serverDiscoveryService.waitForServerDiscovery({
        serverDiscovery
      });

      return serverDiscoveryPresenter(res);
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverDiscoveryId: v.string()
      })
    )
    .do(async ctx => {
      let discovery = await serverDiscoveryService.getDiscoveryById({
        tenant: ctx.tenant,
        serverDiscoveryId: ctx.input.serverDiscoveryId
      });

      return serverDiscoveryPresenter(discovery);
    }),

  getForVersion: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverVersionId: v.string()
      })
    )
    .do(async ctx => {
      let serverVersion = await serverVersionService.getServerVersionById({
        tenant: ctx.tenant,
        serverVersionId: ctx.input.serverVersionId
      });

      let disc = await serverDiscoveryService.getServerDiscoveryForVersion({
        tenant: ctx.tenant,
        serverVersion
      });
      if (!disc) return null;

      return serverDiscoveryPresenter(
        await serverDiscoveryService.waitForServerDiscovery({
          serverDiscovery: disc
        })
      );
    })
});
