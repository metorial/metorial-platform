import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { agentInstanceType } from '../../../types';

export let v1AgentInstancePresenter = Presenter.create(agentInstanceType)
  .presenter(async ({ agentInstance }) => ({
    object: 'agent.instance' as const,
    id: agentInstance.id,
    type: agentInstance.type,
    name: agentInstance.name,
    version: agentInstance.version,
    description: agentInstance.description,
    agent_id: agentInstance.agent.id,
    agent_client: agentInstance.agentClient
      ? {
          object: 'agent.client' as const,
          id: agentInstance.agentClient.id,
          type: agentInstance.agentClient.type,
          name: agentInstance.agentClient.name,
          created_at: agentInstance.agentClient.createdAt,
          updated_at: agentInstance.agentClient.updatedAt,
          last_connected_at: agentInstance.agentClient.lastConnectedAt
        }
      : null,
    created_at: agentInstance.createdAt,
    updated_at: agentInstance.updatedAt,
    last_connected_at: agentInstance.lastConnectedAt
  }))
  .schema(
    v.object({
      object: v.literal('agent.instance'),
      id: v.string(),
      type: v.enumOf(['mcp_client', 'tool_call'] as const),
      name: v.string(),
      version: v.nullable(v.string()),
      description: v.nullable(v.string()),
      agent_id: v.string(),
      agent_client: v.nullable(
        v.object({
          object: v.literal('agent.client'),
          id: v.string(),
          type: v.enumOf(['mcp_client_oauth'] as const),
          name: v.string(),
          created_at: v.date(),
          updated_at: v.date(),
          last_connected_at: v.nullable(v.date())
        })
      ),
      created_at: v.date(),
      updated_at: v.date(),
      last_connected_at: v.nullable(v.date())
    })
  )
  .build();
