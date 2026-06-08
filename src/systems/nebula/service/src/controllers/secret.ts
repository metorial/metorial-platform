import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { secretPresenter, secretUsePresenter, secretVersionPresenter } from '../presenters';
import { secretService } from '../services';
import { app } from './_app';
import { consumerInstanceApp } from './consumer';
import { tenantApp } from './tenant';

export let secretApp = tenantApp.use(async ctx => {
  let secretId = ctx.body.secretId;
  if (!secretId) throw new Error('Secret ID is required');

  let secret = await secretService.getSecretById({
    tenant: ctx.tenant,
    id: secretId
  });

  return { secret };
});

export let secretController = app.controller({
  create: consumerInstanceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        consumerToken: v.string(),
        purpose: v.string(),
        secret: v.string(),
        proof: v.any(),
        encryptionContext: v.optional(v.any()),
        keyProviderId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let secret = await secretService.createSecret({
        tenant: ctx.tenant,
        consumer: ctx.consumer,
        input: {
          purpose: ctx.input.purpose,
          secret: ctx.input.secret,
          proof: ctx.input.proof,
          encryptionContext: ctx.input.encryptionContext,
          keyProviderId: ctx.input.keyProviderId
        }
      });
      return await secretPresenter(secret);
    }),

  update: consumerInstanceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        secretId: v.string(),
        consumerToken: v.string(),
        secret: v.string(),
        proof: v.any(),
        encryptionContext: v.optional(v.any()),
        keyProviderId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let currentSecret = await secretService.getSecretById({
        tenant: ctx.tenant,
        id: ctx.input.secretId
      });

      let secret = await secretService.updateSecret({
        tenant: ctx.tenant,
        consumer: ctx.consumer,
        secret: currentSecret,
        input: {
          secret: ctx.input.secret,
          proof: ctx.input.proof,
          encryptionContext: ctx.input.encryptionContext,
          keyProviderId: ctx.input.keyProviderId
        }
      });
      return await secretPresenter(secret);
    }),

  disable: consumerInstanceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        secretId: v.string(),
        consumerToken: v.string()
      })
    )
    .do(async ctx => {
      let currentSecret = await secretService.getSecretById({
        tenant: ctx.tenant,
        id: ctx.input.secretId
      });

      let secret = await secretService.disableSecret({
        tenant: ctx.tenant,
        consumer: ctx.consumer,
        secret: currentSecret
      });
      return await secretPresenter(secret);
    }),

  list: tenantApp
    .handler()
    .input(Paginator.validate(v.object({ tenantId: v.string() })))
    .do(async ctx => {
      let paginator = await secretService.listSecrets({ tenant: ctx.tenant });
      let list = await paginator.run(ctx.input);
      return await Paginator.presentLight(list, secret => secretPresenter(secret));
    }),

  get: secretApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        secretId: v.string()
      })
    )
    .do(async ctx => await secretPresenter(ctx.secret)),

  use: consumerInstanceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        consumerToken: v.string(),
        secretId: v.string(),
        proof: v.any(),
        note: v.string()
      })
    )
    .do(async ctx => {
      let secret = await secretService.getSecretById({
        tenant: ctx.tenant,
        id: ctx.input.secretId
      });
      let used = await secretService.useSecret({
        tenant: ctx.tenant,
        consumer: ctx.consumer,
        consumerInstance: ctx.consumerInstance,
        secret,
        proof: ctx.input.proof,
        note: ctx.input.note
      });
      return await secretUsePresenter(used);
    }),

  listVersions: secretApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          secretId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await secretService.listSecretVersions({
        tenant: ctx.tenant,
        secret: ctx.secret
      });
      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, secretVersionPresenter);
    })
});
