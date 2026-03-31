import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderDeploymentsConfigsListOutput = {
  items: {
    object: 'provider.config';
    id: string;
    isDefault: boolean;
    name: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    toolFilter:
      | { type: 'allow_all'; ignoreParentFilters: boolean }
      | {
          type: 'filter';
          filters: (
            | { type: 'tool_keys'; keys: string[] }
            | { type: 'tool_regex'; pattern: string }
            | { type: 'resource_regex'; pattern: string }
            | { type: 'resource_uris'; uris: string[] }
            | { type: 'prompt_keys'; keys: string[] }
            | { type: 'prompt_regex'; pattern: string }
          )[];
          ignoreParentFilters: boolean;
        };
    providerId: string;
    specificationId: string;
    deployment: {
      object: 'provider.deployment#preview';
      id: string;
      isDefault: boolean;
      name: string | null;
      description: string | null;
      metadata: Record<string, any> | null;
      providerId: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    fromVault: {
      object: 'provider.config_vault';
      id: string;
      name: string;
      description: string | null;
      metadata: Record<string, any> | null;
      providerId: string;
      deployment: {
        object: 'provider.deployment#preview';
        id: string;
        isDefault: boolean;
        name: string | null;
        description: string | null;
        metadata: Record<string, any> | null;
        providerId: string;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceProviderDeploymentsConfigsListOutput =
  mtMap.object<DashboardInstanceProviderDeploymentsConfigsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          toolFilter: mtMap.objectField(
            'tool_filter',
            mtMap.union([
              mtMap.unionOption(
                'object',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  ignoreParentFilters: mtMap.objectField(
                    'ignore_parent_filters',
                    mtMap.passthrough()
                  ),
                  filters: mtMap.objectField(
                    'filters',
                    mtMap.array(
                      mtMap.union([
                        mtMap.unionOption(
                          'object',
                          mtMap.object({
                            type: mtMap.objectField(
                              'type',
                              mtMap.passthrough()
                            ),
                            keys: mtMap.objectField(
                              'keys',
                              mtMap.array(mtMap.passthrough())
                            ),
                            pattern: mtMap.objectField(
                              'pattern',
                              mtMap.passthrough()
                            ),
                            uris: mtMap.objectField(
                              'uris',
                              mtMap.array(mtMap.passthrough())
                            )
                          })
                        )
                      ])
                    )
                  )
                })
              )
            ])
          ),
          providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
          specificationId: mtMap.objectField(
            'specification_id',
            mtMap.passthrough()
          ),
          deployment: mtMap.objectField(
            'deployment',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          fromVault: mtMap.objectField(
            'from_vault',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
              deployment: mtMap.objectField(
                'deployment',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  isDefault: mtMap.objectField(
                    'is_default',
                    mtMap.passthrough()
                  ),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  metadata: mtMap.objectField('metadata', mtMap.passthrough()),
                  providerId: mtMap.objectField(
                    'provider_id',
                    mtMap.passthrough()
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
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

export type DashboardInstanceProviderDeploymentsConfigsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?: 'active' | 'archived' | ('active' | 'archived')[] | undefined;
  id?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerSpecificationId?: string | string[] | undefined;
  providerDeploymentId?: string | string[] | undefined;
  providerConfigVaultId?: string | string[] | undefined;
  search?: string | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceProviderDeploymentsConfigsListQuery =
  mtMap.union([
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
        providerSpecificationId: mtMap.objectField(
          'provider_specification_id',
          mtMap.union([
            mtMap.unionOption('string', mtMap.passthrough()),
            mtMap.unionOption(
              'array',
              mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
            )
          ])
        ),
        providerDeploymentId: mtMap.objectField(
          'provider_deployment_id',
          mtMap.union([
            mtMap.unionOption('string', mtMap.passthrough()),
            mtMap.unionOption(
              'array',
              mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
            )
          ])
        ),
        providerConfigVaultId: mtMap.objectField(
          'provider_config_vault_id',
          mtMap.union([
            mtMap.unionOption('string', mtMap.passthrough()),
            mtMap.unionOption(
              'array',
              mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
            )
          ])
        ),
        search: mtMap.objectField('search', mtMap.passthrough()),
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

