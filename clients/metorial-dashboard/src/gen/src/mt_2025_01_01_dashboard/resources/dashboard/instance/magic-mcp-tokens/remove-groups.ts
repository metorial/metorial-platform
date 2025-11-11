import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceMagicMcpTokensRemoveGroupsOutput = {
  object: 'magic_mcp.token';
  id: string;
  status: 'active' | 'deleted';
  secret: string;
  name: string;
  description: string | null;
  groups: {
    object: 'magic_mcp.group';
    id: string;
    status: 'active' | 'deleted';
    slug: string;
    name: string;
    description: string | null;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
  }[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceMagicMcpTokensRemoveGroupsOutput =
  mtMap.object<DashboardInstanceMagicMcpTokensRemoveGroupsOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    secret: mtMap.objectField('secret', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    groups: mtMap.objectField(
      'groups',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          slug: mtMap.objectField('slug', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceMagicMcpTokensRemoveGroupsBody = {
  magicMcpGroupIds: string[];
};

export let mapDashboardInstanceMagicMcpTokensRemoveGroupsBody =
  mtMap.object<DashboardInstanceMagicMcpTokensRemoveGroupsBody>({
    magicMcpGroupIds: mtMap.objectField(
      'magic_mcp_group_ids',
      mtMap.array(mtMap.passthrough())
    )
  });

