import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderDeploymentsConfigsCreateOutput = {
  object: 'provider.config';
  id: string;
  status: 'active' | 'archived' | 'deleted';
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
    status: 'active' | 'archived' | 'deleted';
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
};

export let mapDashboardInstanceProviderDeploymentsConfigsCreateOutput =
  mtMap.object<DashboardInstanceProviderDeploymentsConfigsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
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
                      type: mtMap.objectField('type', mtMap.passthrough()),
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
    specificationId: mtMap.objectField('specification_id', mtMap.passthrough()),
    deployment: mtMap.objectField(
      'deployment',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
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
        status: mtMap.objectField('status', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        deployment: mtMap.objectField(
          'deployment',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
            metadata: mtMap.objectField('metadata', mtMap.passthrough()),
            providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
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
  });

export type DashboardInstanceProviderDeploymentsConfigsCreateBody = {
  providerId: string;
  providerDeploymentId?: string | undefined;
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  toolFilters?:
    | (
        | { type: 'tool_keys'; keys: string[] }
        | { type: 'tool_regex'; pattern: string }
        | { type: 'resource_regex'; pattern: string }
        | { type: 'resource_uris'; uris: string[] }
        | { type: 'prompt_keys'; keys: string[] }
        | { type: 'prompt_regex'; pattern: string }
      )
    | (
        | { type: 'tool_keys'; keys: string[] }
        | { type: 'tool_regex'; pattern: string }
        | { type: 'resource_regex'; pattern: string }
        | { type: 'resource_uris'; uris: string[] }
        | { type: 'prompt_keys'; keys: string[] }
        | { type: 'prompt_regex'; pattern: string }
      )[]
    | null
    | undefined;
} & ({ value: Record<string, any> } | { providerConfigVaultId: string });

export let mapDashboardInstanceProviderDeploymentsConfigsCreateBody =
  mtMap.union([
    mtMap.unionOption(
      'object',
      mtMap.object({
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        providerDeploymentId: mtMap.objectField(
          'provider_deployment_id',
          mtMap.passthrough()
        ),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        toolFilters: mtMap.objectField(
          'tool_filters',
          mtMap.union([
            mtMap.unionOption(
              'object',
              mtMap.object({
                type: mtMap.objectField('type', mtMap.passthrough()),
                keys: mtMap.objectField(
                  'keys',
                  mtMap.array(mtMap.passthrough())
                ),
                pattern: mtMap.objectField('pattern', mtMap.passthrough()),
                uris: mtMap.objectField(
                  'uris',
                  mtMap.array(mtMap.passthrough())
                )
              })
            ),
            mtMap.unionOption(
              'array',
              mtMap.union([
                mtMap.unionOption(
                  'object',
                  mtMap.object({
                    type: mtMap.objectField('type', mtMap.passthrough()),
                    keys: mtMap.objectField(
                      'keys',
                      mtMap.array(mtMap.passthrough())
                    ),
                    pattern: mtMap.objectField('pattern', mtMap.passthrough()),
                    uris: mtMap.objectField(
                      'uris',
                      mtMap.array(mtMap.passthrough())
                    )
                  })
                )
              ])
            )
          ])
        ),
        value: mtMap.objectField('value', mtMap.passthrough()),
        providerConfigVaultId: mtMap.objectField(
          'provider_config_vault_id',
          mtMap.passthrough()
        )
      })
    )
  ]);

