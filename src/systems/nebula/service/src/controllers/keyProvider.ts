import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { keyProviderPresenter, tenantPresenter } from '../presenters';
import { keyProviderService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let keyProviderApp = tenantApp.use(async ctx => {
  let keyProviderId = ctx.body.keyProviderId;
  if (!keyProviderId) throw new Error('Key provider ID is required');

  let keyProvider = await keyProviderService.getKeyProviderById({
    tenant: ctx.tenant,
    id: keyProviderId
  });

  return { keyProvider };
});

export let keyProviderController = app.controller({
  import: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        keyInput: v.record(v.any())
      })
    )
    .do(async ctx => {
      let keyProvider = await keyProviderService.importKeyProvider({
        tenant: ctx.tenant,
        keyInput: ctx.input.keyInput
      });
      return keyProviderPresenter(keyProvider);
    }),

  createManaged: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        name: v.string()
      })
    )
    .do(async ctx => {
      let keyProvider = await keyProviderService.createManaged({
        tenant: ctx.tenant,
        input: {
          name: ctx.input.name
        }
      });
      return keyProviderPresenter(keyProvider);
    }),

  list: tenantApp
    .handler()
    .input(Paginator.validate(v.object({ tenantId: v.string() })))
    .do(async ctx => {
      let paginator = await keyProviderService.listKeyProviders({ tenant: ctx.tenant });
      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, keyProviderPresenter);
    }),

  get: keyProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        keyProviderId: v.string()
      })
    )
    .do(async ctx => keyProviderPresenter(ctx.keyProvider)),

  getSetupInfo: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        region: v.optional(v.string()),
        keyId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let setupInfo = await keyProviderService.getSetupInfo({
        tenant: ctx.tenant,
        input: {
          region: ctx.input.region,
          keyId: ctx.input.keyId
        }
      });

      return {
        object: 'nebula#key_provider_setup_info',
        steps: setupInfo.steps
      };
    }),

  setDefault: keyProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        keyProviderId: v.string()
      })
    )
    .do(async ctx => {
      let tenant = await keyProviderService.setDefaultKeyProvider({
        tenant: ctx.tenant,
        keyProviderId: ctx.keyProvider.id
      });
      return tenantPresenter(tenant);
    }),

  validate: keyProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        keyProviderId: v.string()
      })
    )
    .do(async ctx => {
      let description = await keyProviderService.validateKeyProvider({
        tenant: ctx.tenant,
        keyProviderId: ctx.keyProvider.id
      });

      return {
        object: 'nebula#key_provider_validation',
        keyProviderId: ctx.keyProvider.id,
        description
      };
    })
});
