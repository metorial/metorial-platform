import { mapObject } from '@metorial/util-resource-mapper/compact';

export type AgentsInstancesGetOutput = {
  object: 'agent.instance';
  id: string;
  type: 'mcp_client' | 'tool_call';
  name: string;
  version: string | null;
  description: string | null;
  agentId: string;
  agentClient: {
    object: 'agent.client';
    id: string;
    type: 'mcp_client_oauth';
    name: string;
    createdAt: Date;
    updatedAt: Date;
    lastConnectedAt: Date | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  lastConnectedAt: Date | null;
};

export let mapAgentsInstancesGetOutput =
  /* @__PURE__ */ mapObject<AgentsInstancesGetOutput>(
    [
      'agent_id',
      [
        'agent_client',
        1,
        [1, ['created_at', 'updated_at', 'last_connected_at']]
      ],
      'created_at',
      'updated_at',
      'last_connected_at'
    ],
    1
  );
