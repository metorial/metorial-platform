import type { AgentClient } from '@metorial-subspace/db';

export let agentClientPresenter = (agentClient: AgentClient) => ({
  object: 'agent.client',

  id: agentClient.id,
  type: agentClient.type,

  name: agentClient.name,
  foreignId: agentClient.foreignId,
  privateMetadata: agentClient.privateMetadata,

  createdAt: agentClient.createdAt,
  updatedAt: agentClient.updatedAt,
  lastConnectedAt: agentClient.lastConnectedAt
});
