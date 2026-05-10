import type { TenantActor } from '@metorial-subspace/db';

export let actorPresenter = (actor: TenantActor) => ({
  object: 'actor',

  id: actor.id,
  type: actor.type,
  identifier: actor.identifier,
  name: actor.name,
  organizationActorId: actor.organizationActorId,
  consumerId: actor.consumerId,

  createdAt: actor.createdAt
});
