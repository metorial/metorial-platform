import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceAgentsInstancesGetOutput = {
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

export let mapManagementInstanceAgentsInstancesGetOutput =
  mtMap.object<ManagementInstanceAgentsInstancesGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    version: mtMap.objectField('version', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    agentId: mtMap.objectField('agent_id', mtMap.passthrough()),
    agentClient: mtMap.objectField(
      'agent_client',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date()),
        lastConnectedAt: mtMap.objectField('last_connected_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    lastConnectedAt: mtMap.objectField('last_connected_at', mtMap.date())
  });

