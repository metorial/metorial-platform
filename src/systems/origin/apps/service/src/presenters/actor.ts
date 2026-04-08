import type { Actor } from '../../prisma/generated/browser';

export let actorPresenter = (actor: Actor) => ({
  object: 'origin#actor',

  id: actor.id,
  identifier: actor.identifier,
  name: actor.name,

  createdAt: actor.createdAt
});
