import type { AgentClient } from '@metorial-subspace/db';

export let agentClientPresenter = (agentClient: AgentClient) => ({
  object: 'agent.client',

  id: agentClient.id,
  type: agentClient.type,

  name: agentClient.name,
  privateMetadata: agentClient.privateMetadata,
  oauthRegistrationId: agentClient.oauthRegistrationId,

  createdAt: agentClient.createdAt,
  updatedAt: agentClient.updatedAt,
  lastConnectedAt: agentClient.lastConnectedAt
});
