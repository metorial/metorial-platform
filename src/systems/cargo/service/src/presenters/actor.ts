import type { TenantActor } from '@metorial-cargo/db';

export let actorPresenter = (actor: TenantActor) => ({
  object: 'cargo#actor',
  id: actor.id,
  identifier: actor.identifier,
  type: actor.type,
  name: actor.name,
  organizationActorId: actor.organizationActorId,
  consumerId: actor.consumerId,
  createdAt: actor.createdAt
});
