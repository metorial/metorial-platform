import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceMagicMcpSessionsGetOutput = {
  object: 'magic_mcp.session';
  id: string;
  subspaceSessionId: string;
  subspaceSessionTemplateId: string;
  magicMcpServer: {
    object: 'magic_mcp.server';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    source: 'manual' | 'consumer_provider_template';
    providerTemplateId: string | null;
    endpoints: { id: string; alias: string; url: string }[];
    name: string | null;
    description: string | null;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceMagicMcpSessionsGetOutput =
  mtMap.object<DashboardInstanceMagicMcpSessionsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    subspaceSessionId: mtMap.objectField(
      'subspace_session_id',
      mtMap.passthrough()
    ),
    subspaceSessionTemplateId: mtMap.objectField(
      'subspace_session_template_id',
      mtMap.passthrough()
    ),
    magicMcpServer: mtMap.objectField(
      'magic_mcp_server',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        source: mtMap.objectField('source', mtMap.passthrough()),
        providerTemplateId: mtMap.objectField(
          'provider_template_id',
          mtMap.passthrough()
        ),
        endpoints: mtMap.objectField(
          'endpoints',
          mtMap.array(
            mtMap.object({
              id: mtMap.objectField('id', mtMap.passthrough()),
              alias: mtMap.objectField('alias', mtMap.passthrough()),
              url: mtMap.objectField('url', mtMap.passthrough())
            })
          )
        ),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

