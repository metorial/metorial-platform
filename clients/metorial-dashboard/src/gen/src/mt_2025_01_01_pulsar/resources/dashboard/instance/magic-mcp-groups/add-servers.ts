import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceMagicMcpGroupsAddServersOutput = {
  object: 'magic_mcp.group';
  id: string;
  status: 'active' | 'deleted';
  slug: string;
  name: string;
  description: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceMagicMcpGroupsAddServersOutput =
  mtMap.object<DashboardInstanceMagicMcpGroupsAddServersOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceMagicMcpGroupsAddServersBody = {
  magicMcpServerIds: string[];
};

export let mapDashboardInstanceMagicMcpGroupsAddServersBody =
  mtMap.object<DashboardInstanceMagicMcpGroupsAddServersBody>({
    magicMcpServerIds: mtMap.objectField(
      'magic_mcp_server_ids',
      mtMap.array(mtMap.passthrough())
    )
  });

