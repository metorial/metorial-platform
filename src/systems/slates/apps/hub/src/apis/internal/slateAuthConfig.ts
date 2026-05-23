import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { slateAuthConfigPresenter } from '../../presenters';
import { slateAuthConfigService, slateService, slateVersionService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let slateAuthConfigApp = tenantApp.use(async ctx => {
  let slateAuthConfigId = ctx.body.slateAuthConfigId;
  if (!slateAuthConfigId) throw new Error('Slate AuthConfig ID is required');

  let slateAuthConfig = await slateAuthConfigService.getSlateAuthConfigById({
    id: slateAuthConfigId,
    tenant: ctx.tenant
  });

  return { slateAuthConfig };
});

export let slateAuthConfigController = app.controller({
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
      let paginator = await slateAuthConfigService.listSlateAuthConfigs({
        tenant: ctx.tenant,
        slateIds: ctx.input.slateIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateAuthConfigPresenter);
    }),

  create: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          slateId: v.string(),
          slateVersionId: v.optional(v.string()),
          authMethodId: v.optional(v.string()),
          authConfig: v.record(v.any())
        })
      )
    )
    .do(async ctx => {
      let slate = await slateService.getSlateById({
        id: ctx.input.slateId
      });
      let slateVersion = ctx.input.slateVersionId
        ? await slateVersionService.getSlateVersionById({
            id: ctx.input.slateVersionId,
            slate
          })
        : undefined;

      let res = await slateAuthConfigService.createSlateAuthConfig({
        tenant: ctx.tenant,
        slate,
        slateVersion,

        input: {
          authConfig: ctx.input.authConfig,
          authMethodId: ctx.input.authMethodId
        }
      });

      return slateAuthConfigPresenter(res);
    }),

  get: slateAuthConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateAuthConfigId: v.string()
      })
    )
    .do(async ctx => slateAuthConfigPresenter(ctx.slateAuthConfig)),

  delete: slateAuthConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateAuthConfigId: v.string()
      })
    )
    .do(async ctx => {
      await slateAuthConfigService.deleteSlateAuthConfig({
        tenant: ctx.tenant,
        slateAuthConfig: ctx.slateAuthConfig
      });

      return { success: true };
    }),

  decrypt: slateAuthConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateAuthConfigId: v.string(),
        note: v.string()
      })
    )
    .do(async ctx => {
      let decrypted = await slateAuthConfigService.DANGEROUSLY_decryptAuthConfig({
        slateAuthConfig: ctx.slateAuthConfig,
        tenant: ctx.tenant,
        note: ctx.input.note
      });

      return {
        decryptedAuthConfig: decrypted,
        authConfig: slateAuthConfigPresenter(ctx.slateAuthConfig)
      };
    }),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateAuthConfigIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let slateAuthConfigs = await slateAuthConfigService.getManySlateAuthConfigsByIds({
        ids: ctx.input.slateAuthConfigIds,
        tenant: ctx.tenant
      });

      return slateAuthConfigs.map(slateAuthConfigPresenter);
    })
});
