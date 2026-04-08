import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { slateOAuthCredentialsPresenter } from '../../presenters';
import { slateOAuthCredentialsService, slateService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let slateOAuthCredentialsApp = tenantApp.use(async ctx => {
  let slateOAuthCredentialsId = ctx.body.slateOAuthCredentialsId;
  if (!slateOAuthCredentialsId) throw new Error('Slate OAuthCredentials ID is required');

  let slateOAuthCredentials = await slateOAuthCredentialsService.getSlateOAuthCredentialsById({
    id: slateOAuthCredentialsId,
    tenant: ctx.tenant
  });

  return { slateOAuthCredentials };
});

export let slateOAuthCredentialsController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          slateIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateOAuthCredentialsService.listSlateOAuthCredentials({
        tenant: ctx.tenant,
        slateIds: ctx.input.slateIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateOAuthCredentialsPresenter);
    }),

  create: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          slateId: v.string(),

          clientId: v.string(),
          clientSecret: v.string(),
          scopes: v.array(v.string())
        })
      )
    )
    .do(async ctx => {
      let slate = await slateService.getSlateById({
        id: ctx.input.slateId
      });

      let res = await slateOAuthCredentialsService.createSlateOAuthCredentials({
        tenant: ctx.tenant,

        input: {
          slate,
          clientId: ctx.input.clientId,
          clientSecret: ctx.input.clientSecret,
          scopes: ctx.input.scopes
        }
      });

      return slateOAuthCredentialsPresenter(res);
    }),

  get: slateOAuthCredentialsApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateOAuthCredentialsId: v.string()
      })
    )
    .do(async ctx => slateOAuthCredentialsPresenter(ctx.slateOAuthCredentials)),

  delete: slateOAuthCredentialsApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateOAuthCredentialsId: v.string()
      })
    )
    .do(async ctx => {
      await slateOAuthCredentialsService.deleteSlateOAuthCredentials({
        tenant: ctx.tenant,
        slateOAuthCredentials: ctx.slateOAuthCredentials
      });

      return { success: true };
    }),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateOAuthCredentialsIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let slateOAuthCredentialsList =
        await slateOAuthCredentialsService.getManySlateOAuthCredentialsByIds({
          ids: ctx.input.slateOAuthCredentialsIds,
          tenant: ctx.tenant
        });

      return slateOAuthCredentialsList.map(slateOAuthCredentialsPresenter);
    })
});
