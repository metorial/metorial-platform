import type { TenantActor } from '../db';

export let actorPresenter = (actor: TenantActor) => ({
  object: 'synthesis#actor',
  id: actor.id,
  type: actor.type,
  identifier: actor.identifier,
  name: actor.name,
  organizationActorId: actor.organizationActorId,
  consumerId: actor.consumerId,
  createdAt: actor.createdAt
});
