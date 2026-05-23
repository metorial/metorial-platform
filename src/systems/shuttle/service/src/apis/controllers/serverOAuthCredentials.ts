import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { serverOAuthCredentialsPresenter } from '../../presenters';
import { serverOAuthCredentialsService, serverService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let serverOAuthCredentialsApp = tenantApp.use(async ctx => {
  let serverOAuthCredentialsId = ctx.body.serverOAuthCredentialsId;
  if (!serverOAuthCredentialsId) throw new Error('serverOAuthCredentialsId is required');

  let serverOAuthCredentials =
    await serverOAuthCredentialsService.getServerOAuthCredentialsById({
      tenant: ctx.tenant,
      serverOAuthCredentialsId
    });

  return { serverOAuthCredentials };
});

export let serverOAuthCredentialsController = app.controller({
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
      let paginator = await serverOAuthCredentialsService.listServerOAuthCredentials({
        tenant: ctx.tenant
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, serverOAuthCredentialsPresenter);
    }),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),

        serverId: v.string(),

        clientId: v.optional(v.string()),
        clientSecret: v.optional(v.string()),
        scopes: v.optional(v.array(v.string()))
      })
    )
    .do(async ctx => {
      let server = await serverService.getServerById({
        tenant: ctx.tenant,
        serverId: ctx.input.serverId
      });

      let res = await serverOAuthCredentialsService.createServerOAuthCredentials({
        tenant: ctx.tenant,

        input: {
          server,

          clientId: ctx.input.clientId,
          clientSecret: ctx.input.clientSecret,
          scopes: ctx.input.scopes
        }
      });

      return serverOAuthCredentialsPresenter(res);
    }),

  get: serverOAuthCredentialsApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverOAuthCredentialsId: v.string()
      })
    )
    .do(async ctx => serverOAuthCredentialsPresenter(ctx.serverOAuthCredentials)),

  delete: serverOAuthCredentialsApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverOAuthCredentialsId: v.string()
      })
    )
    .do(async ctx => {
      await serverOAuthCredentialsService.deleteServerOAuthCredentials({
        tenant: ctx.tenant,
        serverOAuthCredentials: ctx.serverOAuthCredentials
      });

      return { success: true };
    })
});
