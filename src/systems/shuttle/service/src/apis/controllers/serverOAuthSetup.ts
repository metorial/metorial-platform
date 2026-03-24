import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { serverOAuthSetupPresenter } from '../../presenters';
import {
  serverOAuthCredentialsService,
  serverOAuthSetupService,
  serverService
} from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let serverOAuthSetupApp = tenantApp.use(async ctx => {
  let serverOAuthSetupId = ctx.body.serverOAuthSetupId;
  if (!serverOAuthSetupId) throw new Error('serverOAuthSetupId is required');

  let serverOAuthSetup = await serverOAuthSetupService.getServerOAuthSetupById({
    tenant: ctx.tenant,
    serverOAuthSetupId
  });

  return { serverOAuthSetup };
});

export let serverOAuthSetupController = app.controller({
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
      let paginator = await serverOAuthSetupService.listServerOAuthSetups({
        tenant: ctx.tenant
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, serverOAuthSetupPresenter);
    }),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),

        serverCredentialsId: v.optional(v.string()),
        serverId: v.string(),
        redirectUrl: v.string(),
        callbackUrlOverride: v.optional(v.string()),

        input: v.optional(v.object({}))
      })
    )
    .do(async ctx => {
      let server = await serverService.getServerById({
        tenant: ctx.tenant,
        serverId: ctx.input.serverId
      });
      let credentials = ctx.input.serverCredentialsId
        ? await serverOAuthCredentialsService.getServerOAuthCredentialsById({
            tenant: ctx.tenant,
            serverOAuthCredentialsId: ctx.input.serverCredentialsId
          })
        : undefined;

      let res = await serverOAuthSetupService.createServerOAuthSetup({
        tenant: ctx.tenant,
        input: {
          server,
          credentials,
          authConfig: ctx.input.input,
          redirectUrl: ctx.input.redirectUrl,
          callbackUrlOverride: ctx.input.callbackUrlOverride
        }
      });

      return serverOAuthSetupPresenter(res);
    }),

  get: serverOAuthSetupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverOAuthSetupId: v.string()
      })
    )
    .do(async ctx => serverOAuthSetupPresenter(ctx.serverOAuthSetup))
});
