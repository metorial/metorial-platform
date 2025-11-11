import { mtMap } from '@metorial/util-resource-mapper';

export type MagicMcpServersListOutput = {
  items: ({
    object: 'magic_mcp.server';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    endpoints: {
      id: string;
      alias: string;
      urls: { sse: string; streamableHttp: string };
    }[];
    serverDeployments: {
      object: 'server.server_deployment#preview';
      id: string;
      name: string | null;
      description: string | null;
      metadata: Record<string, any>;
      createdAt: Date;
      updatedAt: Date;
      server: {
        object: 'server#preview';
        id: string;
        name: string;
        description: string | null;
        type: 'public' | 'custom';
        createdAt: Date;
        updatedAt: Date;
      };
    }[];
    name: string;
    description: string | null;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
  } & {
    needsDefaultOauthSession: boolean;
    defaultOauthSession: {
      object: 'server.oauth_session#preview';
      id: string;
      status: 'active' | 'archived' | 'deleted';
      metadata: Record<string, any>;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  })[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapMagicMcpServersListOutput =
  mtMap.object<MagicMcpServersListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.union([
          mtMap.unionOption(
            'object',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              endpoints: mtMap.objectField(
                'endpoints',
                mtMap.array(
                  mtMap.object({
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    alias: mtMap.objectField('alias', mtMap.passthrough()),
                    urls: mtMap.objectField(
                      'urls',
                      mtMap.object({
                        sse: mtMap.objectField('sse', mtMap.passthrough()),
                        streamableHttp: mtMap.objectField(
                          'streamable_http',
                          mtMap.passthrough()
                        )
                      })
                    )
                  })
                )
              ),
              serverDeployments: mtMap.objectField(
                'server_deployments',
                mtMap.array(
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    name: mtMap.objectField('name', mtMap.passthrough()),
                    description: mtMap.objectField(
                      'description',
                      mtMap.passthrough()
                    ),
                    metadata: mtMap.objectField(
                      'metadata',
                      mtMap.passthrough()
                    ),
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
                    server: mtMap.objectField(
                      'server',
                      mtMap.object({
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
                        id: mtMap.objectField('id', mtMap.passthrough()),
                        name: mtMap.objectField('name', mtMap.passthrough()),
                        description: mtMap.objectField(
                          'description',
                          mtMap.passthrough()
                        ),
                        type: mtMap.objectField('type', mtMap.passthrough()),
                        createdAt: mtMap.objectField(
                          'created_at',
                          mtMap.date()
                        ),
                        updatedAt: mtMap.objectField('updated_at', mtMap.date())
                      })
                    )
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
              updatedAt: mtMap.objectField('updated_at', mtMap.date()),
              needsDefaultOauthSession: mtMap.objectField(
                'needs_default_oauth_session',
                mtMap.passthrough()
              ),
              defaultOauthSession: mtMap.objectField(
                'default_oauth_session',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  status: mtMap.objectField('status', mtMap.passthrough()),
                  metadata: mtMap.objectField('metadata', mtMap.passthrough()),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              )
            })
          )
        ])
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

export type MagicMcpServersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  serverId?: string | string[] | undefined;
  serverVariantId?: string | string[] | undefined;
  serverImplementationId?: string | string[] | undefined;
  sessionId?: string | string[] | undefined;
  magicMcpGroupId?: string | string[] | undefined;
  search?: string | undefined;
};

export let mapMagicMcpServersListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      status: mtMap.objectField(
        'status',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      serverId: mtMap.objectField(
        'server_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      serverVariantId: mtMap.objectField(
        'server_variant_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      serverImplementationId: mtMap.objectField(
        'server_implementation_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      sessionId: mtMap.objectField(
        'session_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      magicMcpGroupId: mtMap.objectField(
        'magic_mcp_group_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      search: mtMap.objectField('search', mtMap.passthrough())
    })
  )
]);

