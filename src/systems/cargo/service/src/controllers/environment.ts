import { v } from '@lowerdeck/validation';
import { environmentPresenter } from '../presenters';
import { environmentService } from '../services';
import { app } from './_app';
import { tenantApp, tenantWithoutEnvironmentApp } from './tenant';

export let environmentController = app.controller({
  upsert: tenantWithoutEnvironmentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        identifier: v.string(),
        name: v.string(),
        type: v.enumOf(['development', 'production'])
      })
    )
    .do(async ctx => {
      let environment = await environmentService.upsertEnvironment({
        tenant: ctx.tenant,
        input: {
          identifier: ctx.input.identifier,
          name: ctx.input.name,
          type: ctx.input.type
        }
      });

      return environmentPresenter(environment);
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string()
      })
    )
    .do(async ctx => environmentPresenter(ctx.environment))
});
