import { v } from '@lowerdeck/validation';
import { actorPresenter } from '../presenters';
import { actorService } from '../services';
import { app } from './_app';
import { tenantWithoutEnvironmentApp } from './tenant';

export let actorApp = tenantWithoutEnvironmentApp.use(async ctx => {
  let actorId = ctx.body.actorId;
  if (!actorId) throw new Error('Actor ID is required');

  let actor = await actorService.getActorById({
    tenant: ctx.tenant,
    actorId
  });

  return { actor };
});

export let actorController = app.controller({
  upsert: tenantWithoutEnvironmentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        actorId: v.optional(v.string()),
        identifier: v.string(),
        type: v.optional(v.enumOf(['external', 'system'])),
        name: v.string(),
        organizationActorId: v.optional(v.string()),
        consumerProfileId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let actor = await actorService.upsertActor({
        tenant: ctx.tenant,
        input: {
          id: ctx.input.actorId,
          identifier: ctx.input.identifier,
          type: ctx.input.type,
          name: ctx.input.name,
          organizationActorId: ctx.input.organizationActorId,
          consumerProfileId: ctx.input.consumerProfileId
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
