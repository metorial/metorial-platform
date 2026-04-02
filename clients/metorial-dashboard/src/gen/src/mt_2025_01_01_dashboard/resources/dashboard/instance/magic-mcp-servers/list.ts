import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceMagicMcpServersListOutput = {
  items: {
    object: 'magic_mcp.server';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    sessionTemplateId: string;
    providerTemplateId: string | null;
    endpoints: { id: string; alias: string; url: string }[];
    name: string | null;
    description: string | null;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceMagicMcpServersListOutput =
  mtMap.object<DashboardInstanceMagicMcpServersListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
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
          description: mtMap.objectField('description', mtMap.passthrough()),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
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

export type DashboardInstanceMagicMcpServersListQuery = {
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
  magicMcpGroupId?: string | string[] | undefined;
  consumerId?: string | string[] | undefined;
  consumerProfileId?: string | string[] | undefined;
  search?: string | undefined;
};

export let mapDashboardInstanceMagicMcpServersListQuery = mtMap.union([
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
      consumerId: mtMap.objectField(
        'consumer_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      consumerProfileId: mtMap.objectField(
        'consumer_profile_id',
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

