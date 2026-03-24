import { v } from '@lowerdeck/validation';
import { actorService } from '@metorial-subspace/module-tenant';
import { actorPresenter } from '@metorial-subspace/presenters';
import { tenantWithoutEnvironmentApp } from './tenant';

export let actorApp = tenantWithoutEnvironmentApp.use(async ctx => {
  let actorId = ctx.body.actorId;
  if (!actorId) throw new Error('Actor ID is required');

  let actor = await actorService.getActorById({
    tenant: ctx.tenant,
    id: actorId
  });

  return { actor };
});

export let actorController = tenantWithoutEnvironmentApp.controller({
  upsert: tenantWithoutEnvironmentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        name: v.string(),
        identifier: v.string(),
        organizationActorId: v.string(),
        type: v.enumOf(['external'])
      })
    )
    .do(async ctx => {
      let actor = await actorService.upsertActor({
        tenant: ctx.tenant,
        input: {
          name: ctx.input.name,
          identifier: ctx.input.identifier,
          type: ctx.input.type,
          organizationActorId: ctx.input.organizationActorId
        }
      });
      return actorPresenter(actor);
    }),

  get: actorApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        actorId: v.string()
      })
    )
    .do(async ctx => actorPresenter(ctx.actor))
});
