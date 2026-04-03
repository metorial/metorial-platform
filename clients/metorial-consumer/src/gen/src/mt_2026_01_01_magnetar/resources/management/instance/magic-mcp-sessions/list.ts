import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceMagicMcpSessionsListOutput = {
  items: {
    object: 'magic_mcp.session';
    id: string;
    subspaceSessionId: string;
    subspaceSessionTemplateId: string;
    magicMcpServer: {
      object: 'magic_mcp.server';
      id: string;
      status: 'active' | 'archived' | 'deleted';
      source: 'manual' | 'consumer_provider_template';
      sessionTemplateId: string;
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceMagicMcpSessionsListOutput =
  mtMap.object<ManagementInstanceMagicMcpSessionsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
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
              sessionTemplateId: mtMap.objectField(
                'session_template_id',
                mtMap.passthrough()
              ),
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
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type ManagementInstanceMagicMcpSessionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { magicMcpServerId?: string | string[] | undefined };

export let mapManagementInstanceMagicMcpSessionsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      magicMcpServerId: mtMap.objectField(
        'magic_mcp_server_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      )
    })
  )
]);

