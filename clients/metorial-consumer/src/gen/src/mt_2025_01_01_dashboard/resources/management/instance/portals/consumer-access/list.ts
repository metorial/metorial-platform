import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstancePortalsConsumerAccessListOutput = {
  items: {
    object: 'consumer.group';
    id: string;
    access: {
      type: 'magic_mcp_group';
      magicMcpGroup: {
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
    };
    consumerGroup: {
      object: 'consumer.group';
      id: string;
      status: 'active' | 'inactive';
      name: string;
      description: string | null;
      isDefault: boolean;
      ssoGroupIds: string[];
      createdAt: Date;
      updatedAt: Date;
    };
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstancePortalsConsumerAccessListOutput =
  mtMap.object<ManagementInstancePortalsConsumerAccessListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          access: mtMap.objectField(
            'access',
            mtMap.object({
              type: mtMap.objectField('type', mtMap.passthrough()),
              magicMcpGroup: mtMap.objectField(
                'magic_mcp_group',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  status: mtMap.objectField('status', mtMap.passthrough()),
                  slug: mtMap.objectField('slug', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  metadata: mtMap.objectField('metadata', mtMap.passthrough()),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              )
            })
          ),
          consumerGroup: mtMap.objectField(
            'consumer_group',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
              ssoGroupIds: mtMap.objectField(
                'sso_group_ids',
                mtMap.array(mtMap.passthrough())
              ),
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

export type ManagementInstancePortalsConsumerAccessListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  consumerGroupId?: string | string[] | undefined;
  magicMcpGroupId?: string | string[] | undefined;
  type?: 'magic_mcp_group' | 'magic_mcp_group'[] | undefined;
};

export let mapManagementInstancePortalsConsumerAccessListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      consumerGroupId: mtMap.objectField(
        'consumer_group_id',
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
      type: mtMap.objectField(
        'type',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      )
    })
  )
]);

