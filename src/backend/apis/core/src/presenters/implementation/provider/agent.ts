import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { agentType } from '../../types';

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
    actor_id: agent.actorId,
    created_at: agent.createdAt,
    updated_at: agent.updatedAt,
    archived_at: agent.archivedAt
  }))
  .schema(
    v.object({
      object: v.literal('agent'),
      id: v.string(),
      type: v.enumOf(['mcp_client', 'custom', 'tool_call'] as const),
      status: v.enumOf(['active', 'archived', 'deleted'] as const),
      name: v.string(),
      description: v.nullable(v.string()),
      slug: v.string(),
      metadata: v.nullable(v.record(v.any())),
      actor_id: v.string(),
      created_at: v.date(),
      updated_at: v.date(),
      archived_at: v.nullable(v.date())
    })
  )
  .build();
