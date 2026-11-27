import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { agentType } from '../../../types';

export let v1AgentPresenter = Presenter.create(agentType)
  .presenter(async ({ agent }) => ({
    object: 'agent' as const,
    id: agent.id,
    type: agent.type,
    status: agent.status,
    name: agent.name,
    description: agent.description,
    slug: agent.slug,
    metadata: agent.metadata,
    actor_id: agent.actor.id,
    created_at: agent.createdAt,
    updated_at: agent.updatedAt,
    archived_at: agent.archivedAt
  }))
  .schema(
    v.object({
      object: v.literal('agent', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.',
        examples: ['agt_4mNoPq8rSt2uVx6y']
      }),
      type: v.enumOf(['mcp_client', 'custom', 'tool_call'] as const, {
        description: 'How the agent connects and runs.'
      }),
      status: v.enumOf(['active', 'archived', 'deleted'] as const, {
        description:
          'Current lifecycle status of the agent. `archived` once you archive the agent.'
      }),
      name: v.string({
        description: 'Display name.'
      }),
      description: v.nullable(
        v.string({
          description: 'Free-text description.'
        })
      ),
      slug: v.string({
        description: 'URL-safe name, unique within the instance.'
      }),
      metadata: v.nullable(
        v.record(v.any(), {
          description: 'Custom data you attach to identify or organize this record.'
        })
      ),
      actor_id: v.string({
        description: 'Identity actor linked to the agent.',
        examples: ['iac_6wQpLk2mZa8nYx4b']
      }),
      created_at: v.date({
        description: 'Creation time.'
      }),
      updated_at: v.date({
        description: 'Last update time.'
      }),
      archived_at: v.nullable(
        v.date({
          description: 'When this was archived. `null` while active.'
        })
      )
    })
  )
  .build();
