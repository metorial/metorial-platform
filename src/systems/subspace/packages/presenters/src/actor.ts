import type { TenantActor } from '@metorial-subspace/db';

export let actorPresenter = (actor: TenantActor) => ({
  object: 'actor',

  id: actor.id,
  type: actor.type,
  identifier: actor.identifier,
  name: actor.name,
  organizationActorId: actor.organizationActorId,

  createdAt: actor.createdAt
});
