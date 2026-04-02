import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput = {
  object: 'provider.setup_session';
  id: string;
  type: 'auth_only' | 'config_only' | 'auth_and_config';
  status:
    | 'failed'
    | 'archived'
    | 'deleted'
    | 'pending'
    | 'completed'
    | 'expired';
  url: string;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  configuration: Record<string, any> | null;
  providerId: string | null;
  identityId: string | null;
  identityCredentialId: string | null;
  authMethod: {
    object: 'provider.capabilities.auth_method';
    id: string;
    type: 'oauth' | 'token' | 'custom';
    key: string;
    name: string;
    description: string | null;
    capabilities: Record<string, any>;
    inputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
    outputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
    scopes:
      | {
          object: 'provider.capabilities.auth_method.scope';
          id: string;
          scope: string;
          name: string;
          description: string | null;
        }[]
      | null;
    providerId: string;
    providerSpecificationId: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
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
  credentials: {
    object: 'provider.auth_credentials';
    id: string;
    type: 'oauth';
    isDefault: boolean;
    isManaged: boolean;
    name: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    providerId: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  authConfig: {
    object: 'provider.auth_config';
    id: string;
    type: 'manual' | 'oauth_automated' | 'oauth_manual';
    source: 'manual' | 'setup_session' | 'system';
    status: 'active' | 'archived' | 'deleted';
    isDefault: boolean;
    providerId: string;
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
    credentials: {
      object: 'provider.auth_credentials';
      id: string;
      type: 'oauth';
      isDefault: boolean;
      isManaged: boolean;
      name: string | null;
      description: string | null;
      metadata: Record<string, any> | null;
      providerId: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    authMethod: {
      object: 'provider.capabilities.auth_method';
      id: string;
      type: 'oauth' | 'token' | 'custom';
      key: string;
      name: string;
      description: string | null;
      capabilities: Record<string, any>;
      inputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
      outputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
      scopes:
        | {
            object: 'provider.capabilities.auth_method.scope';
            id: string;
            scope: string;
            name: string;
            description: string | null;
          }[]
        | null;
      providerId: string;
      providerSpecificationId: string;
      createdAt: Date;
      updatedAt: Date;
    };
    createdAt: Date;
    updatedAt: Date;
  } | null;
  config: {
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
  } | null;
  uiMode: 'metorial_elements' | 'dashboard_embeddable';
  redirectUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

export let mapDashboardInstanceProviderDeploymentsSetupSessionsCreateOutput =
  mtMap.object<DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    configuration: mtMap.objectField('configuration', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    identityId: mtMap.objectField('identity_id', mtMap.passthrough()),
    identityCredentialId: mtMap.objectField(
      'identity_credential_id',
      mtMap.passthrough()
    ),
    authMethod: mtMap.objectField(
      'auth_method',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        key: mtMap.objectField('key', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        capabilities: mtMap.objectField('capabilities', mtMap.passthrough()),
        inputSchema: mtMap.objectField(
          'input_schema',
          mtMap.object({
            type: mtMap.objectField('type', mtMap.passthrough()),
            schema: mtMap.objectField('schema', mtMap.passthrough())
          })
        ),
        outputSchema: mtMap.objectField(
          'output_schema',
          mtMap.object({
            type: mtMap.objectField('type', mtMap.passthrough()),
            schema: mtMap.objectField('schema', mtMap.passthrough())
          })
        ),
        scopes: mtMap.objectField(
          'scopes',
          mtMap.array(
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              scope: mtMap.objectField('scope', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField('description', mtMap.passthrough())
            })
          )
        ),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        providerSpecificationId: mtMap.objectField(
          'provider_specification_id',
          mtMap.passthrough()
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
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
    credentials: mtMap.objectField(
      'credentials',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
        isManaged: mtMap.objectField('is_managed', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    authConfig: mtMap.objectField(
      'auth_config',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        source: mtMap.objectField('source', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
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
        credentials: mtMap.objectField(
          'credentials',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            type: mtMap.objectField('type', mtMap.passthrough()),
            isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
            isManaged: mtMap.objectField('is_managed', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
            metadata: mtMap.objectField('metadata', mtMap.passthrough()),
            providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        ),
        authMethod: mtMap.objectField(
          'auth_method',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            type: mtMap.objectField('type', mtMap.passthrough()),
            key: mtMap.objectField('key', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
            capabilities: mtMap.objectField(
              'capabilities',
              mtMap.passthrough()
            ),
            inputSchema: mtMap.objectField(
              'input_schema',
              mtMap.object({
                type: mtMap.objectField('type', mtMap.passthrough()),
                schema: mtMap.objectField('schema', mtMap.passthrough())
              })
            ),
            outputSchema: mtMap.objectField(
              'output_schema',
              mtMap.object({
                type: mtMap.objectField('type', mtMap.passthrough()),
                schema: mtMap.objectField('schema', mtMap.passthrough())
              })
            ),
            scopes: mtMap.objectField(
              'scopes',
              mtMap.array(
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  scope: mtMap.objectField('scope', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  )
                })
              )
            ),
            providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
            providerSpecificationId: mtMap.objectField(
              'provider_specification_id',
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
    config: mtMap.objectField(
      'config',
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
    ),
    uiMode: mtMap.objectField('ui_mode', mtMap.passthrough()),
    redirectUrl: mtMap.objectField('redirect_url', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

export type DashboardInstanceProviderDeploymentsSetupSessionsCreateBody = {
  providerId?: string | undefined;
  providerDeploymentId?: string | undefined;
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  providerAuthMethodId?: string | undefined;
  providerAuthCredentialsId?: string | undefined;
  identityId?: string | undefined;
  redirectUrl?: string | undefined;
  configuration?:
    | {
        providerSearch?:
          | {
              groups?: { groupId: string }[] | undefined;
              collections?: { collectionId: string }[] | undefined;
              categories?: { categoryId: string }[] | undefined;
            }
          | undefined;
        toolFilters?: { enabled?: boolean | undefined } | undefined;
        ui?: { layout?: 'box' | 'side' | 'light' | undefined } | undefined;
      }
    | undefined;
};

export let mapDashboardInstanceProviderDeploymentsSetupSessionsCreateBody =
  mtMap.object<DashboardInstanceProviderDeploymentsSetupSessionsCreateBody>({
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    providerDeploymentId: mtMap.objectField(
      'provider_deployment_id',
      mtMap.passthrough()
    ),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providerAuthMethodId: mtMap.objectField(
      'provider_auth_method_id',
      mtMap.passthrough()
    ),
    providerAuthCredentialsId: mtMap.objectField(
      'provider_auth_credentials_id',
      mtMap.passthrough()
    ),
    identityId: mtMap.objectField('identity_id', mtMap.passthrough()),
    redirectUrl: mtMap.objectField('redirect_url', mtMap.passthrough()),
    configuration: mtMap.objectField(
      'configuration',
      mtMap.object({
        providerSearch: mtMap.objectField(
          'provider_search',
          mtMap.object({
            groups: mtMap.objectField(
              'groups',
              mtMap.array(
                mtMap.object({
                  groupId: mtMap.objectField('group_id', mtMap.passthrough())
                })
              )
            ),
            collections: mtMap.objectField(
              'collections',
              mtMap.array(
                mtMap.object({
                  collectionId: mtMap.objectField(
                    'collection_id',
                    mtMap.passthrough()
                  )
                })
              )
            ),
            categories: mtMap.objectField(
              'categories',
              mtMap.array(
                mtMap.object({
                  categoryId: mtMap.objectField(
                    'category_id',
                    mtMap.passthrough()
                  )
                })
              )
            )
          })
        ),
        toolFilters: mtMap.objectField(
          'tool_filters',
          mtMap.object({
            enabled: mtMap.objectField('enabled', mtMap.passthrough())
          })
        ),
        ui: mtMap.objectField(
          'ui',
          mtMap.object({
            layout: mtMap.objectField('layout', mtMap.passthrough())
          })
        )
      })
    )
  });

