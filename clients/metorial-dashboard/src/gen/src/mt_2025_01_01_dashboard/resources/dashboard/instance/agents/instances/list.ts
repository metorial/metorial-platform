import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAgentsInstancesListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceAgentsInstancesListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceAgentsInstancesListOutput>(
    [
      7,
      [
        1,
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
        ]
      ]
    ],
    1
  );

export type DashboardInstanceAgentsInstancesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  type?:
    | 'mcp_client'
    | 'tool_call'
    | ('mcp_client' | 'tool_call')[]
    | undefined;
  id?: string | string[] | undefined;
  agentClientId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceAgentsInstancesListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceAgentsInstancesListQuery>([
    3,
    [[0, [1, ['agent_client_id', ['created_at', 1, 5], ['updated_at', 1, 5]]]]]
  ]);
