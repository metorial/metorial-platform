import type { Agent, IdentityActor } from '@metorial-subspace/db';

export let identityActorPresenter = (
  actor: IdentityActor & {
    agent: Agent | null;
  }
) => ({
  object: 'identity.actor',

  id: actor.id,
  type: actor.type,
  status: actor.status,

  name: actor.name,
  description: actor.description,
  metadata: actor.metadata,

  agentId: actor.agent?.id ?? null,

  createdAt: actor.createdAt,
  updatedAt: actor.updatedAt,
  archivedAt: actor.archivedAt
});
