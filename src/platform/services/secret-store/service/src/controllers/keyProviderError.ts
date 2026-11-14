import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { keyProviderErrorPresenter } from '../presenters';
import { keyProviderErrorService } from '../services';
import { app } from './_app';
import { keyProviderApp } from './keyProvider';

export let keyProviderErrorController = app.controller({
  list: keyProviderApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          keyProviderId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await keyProviderErrorService.listKeyProviderErrors({
        tenant: ctx.tenant,
        keyProvider: ctx.keyProvider
      });
      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, keyProviderErrorPresenter);
    })
});
