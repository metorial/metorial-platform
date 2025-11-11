import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceMagicMcpGroupsAddServersOutput = {
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

export let mapManagementInstanceMagicMcpGroupsAddServersOutput =
  mtMap.object<ManagementInstanceMagicMcpGroupsAddServersOutput>({
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

export type ManagementInstanceMagicMcpGroupsAddServersBody = {
  magicMcpServerIds: string[];
};

export let mapManagementInstanceMagicMcpGroupsAddServersBody =
  mtMap.object<ManagementInstanceMagicMcpGroupsAddServersBody>({
    magicMcpServerIds: mtMap.objectField(
      'magic_mcp_server_ids',
      mtMap.array(mtMap.passthrough())
    )
  });

