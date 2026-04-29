import type { Agent, AgentClient, AgentInstance } from '@metorial-subspace/db';
import { agentClientPresenter } from './agentClient';

export let agentInstancePresenter = (
  agentInstance: AgentInstance & {
    agent: Agent;
    agentClient: AgentClient | null;
  }
) => ({
  object: 'agent.instance',

  id: agentInstance.id,
  type: agentInstance.type,

  name: agentInstance.name,
  version: agentInstance.version,
  description: agentInstance.description,

  agentId: agentInstance.agent.id,
  agentClientId: agentInstance.agentClient?.id ?? null,
  agentClient: agentInstance.agentClient ? agentClientPresenter(agentInstance.agentClient) : null,

  createdAt: agentInstance.createdAt,
  updatedAt: agentInstance.updatedAt,
  lastConnectedAt: agentInstance.lastConnectedAt
});
