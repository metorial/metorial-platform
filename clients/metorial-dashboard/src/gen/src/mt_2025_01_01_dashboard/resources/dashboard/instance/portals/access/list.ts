import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstancePortalsAccessListOutput = {
  items: {
    object: 'consumer.access';
    id: string;
    name: string;
    description: string | null;
    readme: string | null;
    access:
      | {
          type: 'provider_template';
          providerTemplate: {
            object: 'provider.template#preview';
            id: string;
            status: 'active' | 'archived' | 'deleted';
            name: string;
            description: string | null;
            metadata: Record<string, any>;
            integrationId: string | null;
            createdAt: Date;
            updatedAt: Date;
          };
        }
      | {
          type: 'magic_mcp_server';
          magicMcpServer: {
            object: 'magic_mcp.server#preview';
            id: string;
            status: 'active' | 'archived' | 'deleted';
            name: string | null;
            description: string | null;
          };
        }
      | {
          type: 'skill';
          skill: {
            object: 'skill';
            id: string;
            status: 'active' | 'archived' | 'deleted';
            name: string;
          };
        }
      | {
          type: 'skill_template';
          skillTemplate: {
            object: 'skill.template';
            id: string;
            status: 'active' | 'archived' | 'deleted';
            owner: 'system' | 'tenant';
            name: string;
            description: string | null;
          };
        }
      | {
          type: 'skill_group';
          skillGroup: {
            object: 'skill.group';
            id: string;
            status: 'active' | 'archived' | 'deleted';
            name: string;
            description: string | null;
          };
        }
      | {
          type: 'skill_marketplace';
          skillMarketplace: {
            object: 'skill.marketplace';
            id: string;
            status: 'active' | 'archived' | 'deleted';
          };
        };
    consumerGroup: {
      object: 'consumer.group';
      id: string;
      status: 'active' | 'archived' | 'deleted';
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

export let mapDashboardInstancePortalsAccessListOutput =
  mtMap.object<DashboardInstancePortalsAccessListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          readme: mtMap.objectField('readme', mtMap.passthrough()),
          access: mtMap.objectField(
            'access',
            mtMap.union([
              mtMap.unionOption(
                'object',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  providerTemplate: mtMap.objectField(
                    'provider_template',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      status: mtMap.objectField('status', mtMap.passthrough()),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      description: mtMap.objectField(
                        'description',
                        mtMap.passthrough()
                      ),
                      metadata: mtMap.objectField(
                        'metadata',
                        mtMap.passthrough()
                      ),
                      integrationId: mtMap.objectField(
                        'integration_id',
                        mtMap.passthrough()
                      ),
                      createdAt: mtMap.objectField('created_at', mtMap.date()),
                      updatedAt: mtMap.objectField('updated_at', mtMap.date())
                    })
                  ),
                  magicMcpServer: mtMap.objectField(
                    'magic_mcp_server',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      status: mtMap.objectField('status', mtMap.passthrough()),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      description: mtMap.objectField(
                        'description',
                        mtMap.passthrough()
                      )
                    })
                  ),
                  skill: mtMap.objectField(
                    'skill',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      status: mtMap.objectField('status', mtMap.passthrough()),
                      name: mtMap.objectField('name', mtMap.passthrough())
                    })
                  ),
                  skillTemplate: mtMap.objectField(
                    'skill_template',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      status: mtMap.objectField('status', mtMap.passthrough()),
                      owner: mtMap.objectField('owner', mtMap.passthrough()),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      description: mtMap.objectField(
                        'description',
                        mtMap.passthrough()
                      )
                    })
                  ),
                  skillGroup: mtMap.objectField(
                    'skill_group',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      status: mtMap.objectField('status', mtMap.passthrough()),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      description: mtMap.objectField(
                        'description',
                        mtMap.passthrough()
                      )
                    })
                  ),
                  skillMarketplace: mtMap.objectField(
                    'skill_marketplace',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      status: mtMap.objectField('status', mtMap.passthrough())
                    })
                  )
                })
              )
            ])
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

export type DashboardInstancePortalsAccessListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  consumerGroupId?: string | string[] | undefined;
  providerTemplateId?: string | string[] | undefined;
  magicMcpServerId?: string | string[] | undefined;
  skillId?: string | string[] | undefined;
  skillTemplateId?: string | string[] | undefined;
  skillGroupId?: string | string[] | undefined;
  skillMarketplaceId?: string | string[] | undefined;
  consumerAccessListingId?: string | string[] | undefined;
  type?:
    | 'provider_template'
    | 'magic_mcp_server'
    | 'skill'
    | 'skill_template'
    | 'skill_group'
    | 'skill_marketplace'
    | (
        | 'provider_template'
        | 'magic_mcp_server'
        | 'skill'
        | 'skill_template'
        | 'skill_group'
        | 'skill_marketplace'
      )[]
    | undefined;
};

export let mapDashboardInstancePortalsAccessListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      search: mtMap.objectField('search', mtMap.passthrough()),
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
      providerTemplateId: mtMap.objectField(
        'provider_template_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      magicMcpServerId: mtMap.objectField(
        'magic_mcp_server_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      skillId: mtMap.objectField(
        'skill_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      skillTemplateId: mtMap.objectField(
        'skill_template_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      skillGroupId: mtMap.objectField(
        'skill_group_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      skillMarketplaceId: mtMap.objectField(
        'skill_marketplace_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      consumerAccessListingId: mtMap.objectField(
        'consumer_access_listing_id',
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

