import type { Agent, IdentityActor } from '@metorial-subspace/db';

export let agentPresenter = (
  agent: Agent & {
    actor: IdentityActor;
  }
) => ({
  object: 'agent',

  id: agent.id,
  type: agent.type,
  status: agent.status,

  name: agent.name,
  description: agent.description,
  slug: agent.slug,
  metadata: agent.metadata,
  privateMetadata: agent.privateMetadata,
  hash: agent.hash,

  actorId: agent.actor.id,

  createdAt: agent.createdAt,
  updatedAt: agent.updatedAt,
  archivedAt: agent.archivedAt
});
