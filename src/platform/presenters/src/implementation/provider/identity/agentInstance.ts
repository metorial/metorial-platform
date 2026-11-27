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
      object: v.literal('agent.instance', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.'
      }),
      type: v.enumOf(['mcp_client', 'tool_call'] as const, {
        description: 'How the agent instance connects and runs.'
      }),
      name: v.string({
        description: 'Display name.'
      }),
      version: v.nullable(
        v.string({
          description: 'Client version. `null` when the instance reports no version.'
        })
      ),
      description: v.nullable(
        v.string({
          description: 'Free-text description.'
        })
      ),
      agent_id: v.string({
        description: 'Agent this instance belongs to.',
        examples: ['agt_4mNoPq8rSt2uVx6y']
      }),
      agent_client: v.nullable(
        v.object(
          {
            object: v.literal('agent.client', {
              description: 'String representing the object’s type.'
            }),
            id: v.string({
              description: 'Unique ID.'
            }),
            type: v.enumOf(['mcp_client_oauth'] as const, {
              description: 'How the client connects.'
            }),
            name: v.string({
              description: 'Display name.'
            }),
            created_at: v.date({
              description: 'Creation time.'
            }),
            updated_at: v.date({
              description: 'Last update time.'
            }),
            last_connected_at: v.nullable(
              v.date({
                description: 'When the client last connected. `null` when never connected.'
              })
            )
          },
          {
            description: 'Client this instance connects with.'
          }
        )
      ),
      created_at: v.date({
        description: 'Creation time.'
      }),
      updated_at: v.date({
        description: 'Last update time.'
      }),
      last_connected_at: v.nullable(
        v.date({
          description: 'When the instance last connected. `null` when never connected.'
        })
      )
    })
  )
  .build();
