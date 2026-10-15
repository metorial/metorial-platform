import { mapObject } from '@metorial/util-resource-mapper/compact';

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

export let mapAgentsGetOutput = /* @__PURE__ */ mapObject<AgentsGetOutput>(
  ['actor_id', 'created_at', 'updated_at', 'archived_at'],
  1
);
