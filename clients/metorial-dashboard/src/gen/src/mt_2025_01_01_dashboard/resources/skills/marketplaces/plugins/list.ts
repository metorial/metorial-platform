import { mtMap } from '@metorial/util-resource-mapper';

export type SkillsMarketplacesPluginsListOutput = {
  items: {
    object: 'skill.marketplace_plugin';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    identifier: string;
    skillConfigurationId: string | null;
    skillMarketplaceId: string | null;
    skillPluginId: string | null;
    skillPlugin: {
      object: 'skill.plugin';
      id: string;
      status: 'active' | 'archived' | 'deleted';
      syncStatus: 'pending' | 'processing' | 'synced';
      imageUrl: string;
      name: string;
      description: string | null;
      longDescription: string | null;
      category: string | null;
      slug: string;
      skillConfigurationId: string | null;
      skills: {
        object: 'skill.plugin_skill';
        id: string;
        identifier: string;
        status: 'active' | 'archived' | 'deleted';
        clientName: string | null;
        clientDescription: string | null;
        clientMetadata: Record<string, any> | null;
        license: string | null;
        compatibility: string | null;
        skillConfigurationId: string | null;
        skillId: string;
        createdAt: Date;
        updatedAt: Date;
      }[];
      createdAt: Date;
      updatedAt: Date;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSkillsMarketplacesPluginsListOutput =
  mtMap.object<SkillsMarketplacesPluginsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          identifier: mtMap.objectField('identifier', mtMap.passthrough()),
          skillConfigurationId: mtMap.objectField(
            'skill_configuration_id',
            mtMap.passthrough()
          ),
          skillMarketplaceId: mtMap.objectField(
            'skill_marketplace_id',
            mtMap.passthrough()
          ),
          skillPluginId: mtMap.objectField(
            'skill_plugin_id',
            mtMap.passthrough()
          ),
          skillPlugin: mtMap.objectField(
            'skill_plugin',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              syncStatus: mtMap.objectField('sync_status', mtMap.passthrough()),
              imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              longDescription: mtMap.objectField(
                'long_description',
                mtMap.passthrough()
              ),
              category: mtMap.objectField('category', mtMap.passthrough()),
              slug: mtMap.objectField('slug', mtMap.passthrough()),
              skillConfigurationId: mtMap.objectField(
                'skill_configuration_id',
                mtMap.passthrough()
              ),
              skills: mtMap.objectField(
                'skills',
                mtMap.array(
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    identifier: mtMap.objectField(
                      'identifier',
                      mtMap.passthrough()
                    ),
                    status: mtMap.objectField('status', mtMap.passthrough()),
                    clientName: mtMap.objectField(
                      'client_name',
                      mtMap.passthrough()
                    ),
                    clientDescription: mtMap.objectField(
                      'client_description',
                      mtMap.passthrough()
                    ),
                    clientMetadata: mtMap.objectField(
                      'client_metadata',
                      mtMap.passthrough()
                    ),
                    license: mtMap.objectField('license', mtMap.passthrough()),
                    compatibility: mtMap.objectField(
                      'compatibility',
                      mtMap.passthrough()
                    ),
                    skillConfigurationId: mtMap.objectField(
                      'skill_configuration_id',
                      mtMap.passthrough()
                    ),
                    skillId: mtMap.objectField('skill_id', mtMap.passthrough()),
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date())
                  })
                )
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

export type SkillsMarketplacesPluginsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  skillPluginId?: string | string[] | undefined;
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  skillConfigurationId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapSkillsMarketplacesPluginsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      id: mtMap.objectField(
        'id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      skillPluginId: mtMap.objectField(
        'skill_plugin_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      status: mtMap.objectField(
        'status',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      skillConfigurationId: mtMap.objectField(
        'skill_configuration_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      createdAt: mtMap.objectField(
        'created_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      ),
      updatedAt: mtMap.objectField(
        'updated_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      )
    })
  )
]);

