import { mtMap } from '@metorial/util-resource-mapper';

export type SkillsItemsListOutput = {
  items: {
    object: 'skill.item';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    type: 'integration' | 'provider';
    skillId: string;
    integration: {
      object: 'integration#preview';
      id: string;
      slug: string;
      name: string;
      description: string | null;
      metadata: Record<string, any> | null;
      configuration: {
        canAttachCustomToolFilters: boolean;
        canAttachCustomProviderConfig: boolean;
        canOverrideToolFilters: boolean;
      };
      createdAt: Date;
      updatedAt: Date;
      archivedAt: Date | null;
    } | null;
    provider: {
      object: 'provider#preview';
      id: string;
      name: string;
      description: string | null;
      slug: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSkillsItemsListOutput = mtMap.object<SkillsItemsListOutput>({
  items: mtMap.objectField(
    'items',
    mtMap.array(
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        skillId: mtMap.objectField('skill_id', mtMap.passthrough()),
        integration: mtMap.objectField(
          'integration',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            slug: mtMap.objectField('slug', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
            metadata: mtMap.objectField('metadata', mtMap.passthrough()),
            configuration: mtMap.objectField(
              'configuration',
              mtMap.object({
                canAttachCustomToolFilters: mtMap.objectField(
                  'can_attach_custom_tool_filters',
                  mtMap.passthrough()
                ),
                canAttachCustomProviderConfig: mtMap.objectField(
                  'can_attach_custom_provider_config',
                  mtMap.passthrough()
                ),
                canOverrideToolFilters: mtMap.objectField(
                  'can_override_tool_filters',
                  mtMap.passthrough()
                )
              })
            ),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date()),
            archivedAt: mtMap.objectField('archived_at', mtMap.date())
          })
        ),
        provider: mtMap.objectField(
          'provider',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
            slug: mtMap.objectField('slug', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    )
  ),
  pagination: mtMap.objectField(
    'pagination',
    mtMap.object({
      hasMoreBefore: mtMap.objectField('has_more_before', mtMap.passthrough()),
      hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
    })
  )
});

export type SkillsItemsListQuery = {
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
  type?:
    | 'integration'
    | 'provider'
    | ('integration' | 'provider')[]
    | undefined;
  id?: string | string[] | undefined;
  integrationId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapSkillsItemsListQuery = mtMap.union([
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
      type: mtMap.objectField(
        'type',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
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
      integrationId: mtMap.objectField(
        'integration_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerId: mtMap.objectField(
        'provider_id',
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
      )
    })
  )
]);

