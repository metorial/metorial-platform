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
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        name: v.string(),
        keyId: v.optional(v.string()),
        region: v.optional(v.string()),
        keyReuseTimeSeconds: v.optional(v.number())
      })
    )
    .do(async ctx => {
      let keyProvider = await keyProviderService.createKeyProvider({
        tenant: ctx.tenant,
        input: {
          name: ctx.input.name,
          keyId: ctx.input.keyId,
          region: ctx.input.region,
          keyReuseTimeSeconds: ctx.input.keyReuseTimeSeconds
        } as any
      });
      return keyProviderPresenter(keyProvider);
    }),

  createManagedKms: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        name: v.string(),
        region: v.optional(v.string()),
        keyReuseTimeSeconds: v.optional(v.number())
      })
    )
    .do(async ctx => {
      let keyProvider = await keyProviderService.createManagedKmsKeyProvider({
        tenant: ctx.tenant,
        input: {
          name: ctx.input.name,
          region: ctx.input.region,
          keyReuseTimeSeconds: ctx.input.keyReuseTimeSeconds
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
