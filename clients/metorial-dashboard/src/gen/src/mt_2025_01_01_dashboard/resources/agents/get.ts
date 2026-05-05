import { mtMap } from '@metorial/util-resource-mapper';

export type AgentsGetOutput = {
  object: 'agent';
  id: string;
  type: 'mcp_client' | 'custom' | 'tool_call';
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  slug: string;
  metadata: Record<string, any> | null;
  actorId: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export let mapAgentsGetOutput = mtMap.object<AgentsGetOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  type: mtMap.objectField('type', mtMap.passthrough()),
  status: mtMap.objectField('status', mtMap.passthrough()),
  name: mtMap.objectField('name', mtMap.passthrough()),
  description: mtMap.objectField('description', mtMap.passthrough()),
  slug: mtMap.objectField('slug', mtMap.passthrough()),
  metadata: mtMap.objectField('metadata', mtMap.passthrough()),
  actorId: mtMap.objectField('actor_id', mtMap.passthrough()),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  updatedAt: mtMap.objectField('updated_at', mtMap.date()),
  archivedAt: mtMap.objectField('archived_at', mtMap.date())
});

