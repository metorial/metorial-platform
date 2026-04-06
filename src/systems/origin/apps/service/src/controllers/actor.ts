import { v } from '@lowerdeck/validation';
import { actorPresenter } from '../presenters/actor';
import { actorService } from '../services';
import { app } from './_app';

export let actorApp = app.use(async ctx => {
  let actorId = ctx.body.actorId;
  if (!actorId) throw new Error('Actor ID is required');

  let actor = await actorService.getActorById({ id: actorId });

  return { actor };
});

export let actorController = app.controller({
  upsert: app
    .handler()
    .input(
      v.object({
        name: v.string(),
        identifier: v.string()
      })
    )
    .do(async ctx => {
      let actor = await actorService.upsertActor({
        input: {
          name: ctx.input.name,
          identifier: ctx.input.identifier
        }
      });
      return actorPresenter(actor);
    }),

  get: actorApp
    .handler()
    .input(
      v.object({
        actorId: v.string()
      })
    )
    .do(async ctx => actorPresenter(ctx.actor))
});
