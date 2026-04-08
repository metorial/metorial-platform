import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProviderDeploymentsAuthConfigsImportsCreateOutput =
  {
    object: 'provider.auth_import';
    id: string;
    note: string;
    ip: string | null;
    userAgent: string | null;
    metadata: Record<string, any> | null;
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
        status: 'active' | 'archived' | 'deleted';
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
        inputSchema: {
          type: 'json_schema';
          schema: Record<string, any>;
        } | null;
        outputSchema: {
          type: 'json_schema';
          schema: Record<string, any>;
        } | null;
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
    };
    providerId: string;
    providerDeploymentId: string | null;
    authMethodId: string;
    credentialsId: string | null;
    createdAt: Date;
    expiresAt: Date | null;
  };

export let mapManagementInstanceProviderDeploymentsAuthConfigsImportsCreateOutput =
  mtMap.object<ManagementInstanceProviderDeploymentsAuthConfigsImportsCreateOutput>(
    {
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      note: mtMap.objectField('note', mtMap.passthrough()),
      ip: mtMap.objectField('ip', mtMap.passthrough()),
      userAgent: mtMap.objectField('user_agent', mtMap.passthrough()),
      metadata: mtMap.objectField('metadata', mtMap.passthrough()),
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
          credentials: mtMap.objectField(
            'credentials',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              type: mtMap.objectField('type', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
              isManaged: mtMap.objectField('is_managed', mtMap.passthrough()),
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
          authMethod: mtMap.objectField(
            'auth_method',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              type: mtMap.objectField('type', mtMap.passthrough()),
              key: mtMap.objectField('key', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
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
      providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
      providerDeploymentId: mtMap.objectField(
        'provider_deployment_id',
        mtMap.passthrough()
      ),
      authMethodId: mtMap.objectField('auth_method_id', mtMap.passthrough()),
      credentialsId: mtMap.objectField('credentials_id', mtMap.passthrough()),
      createdAt: mtMap.objectField('created_at', mtMap.date()),
      expiresAt: mtMap.objectField('expires_at', mtMap.date())
    }
  );

export type ManagementInstanceProviderDeploymentsAuthConfigsImportsCreateBody =
  {
    providerId?: string | undefined;
    providerDeploymentId?: string | undefined;
    providerAuthConfigId?: string | undefined;
    providerAuthMethodId?: string | undefined;
    note: string;
    metadata?: Record<string, any> | undefined;
    value: Record<string, any>;
  };

export let mapManagementInstanceProviderDeploymentsAuthConfigsImportsCreateBody =
  mtMap.object<ManagementInstanceProviderDeploymentsAuthConfigsImportsCreateBody>(
    {
      providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
      providerDeploymentId: mtMap.objectField(
        'provider_deployment_id',
        mtMap.passthrough()
      ),
      providerAuthConfigId: mtMap.objectField(
        'provider_auth_config_id',
        mtMap.passthrough()
      ),
      providerAuthMethodId: mtMap.objectField(
        'provider_auth_method_id',
        mtMap.passthrough()
      ),
      note: mtMap.objectField('note', mtMap.passthrough()),
      metadata: mtMap.objectField('metadata', mtMap.passthrough()),
      value: mtMap.objectField('value', mtMap.passthrough())
    }
  );

