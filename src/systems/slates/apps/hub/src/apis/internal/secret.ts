import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { secretPresenter } from '../../presenters';
import { secretService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let secretApp = tenantApp.use(async ctx => {
  let secretId = ctx.body.secretId;
  if (!secretId) throw new Error('Secret ID is required');

  let secret = await secretService.getSecretById({
    id: secretId,
    tenant: ctx.tenant
  });

  return { secret };
});

export let secretController = app.controller({
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
      let paginator = await secretService.listSecrets({
        tenant: ctx.tenant
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, secretPresenter);
    }),

  get: secretApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        secretId: v.string()
      })
    )
    .do(async ctx => secretPresenter(ctx.secret))
});
