import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceIntegrationsInstancesListOutput = {
  items: {
    object: 'integration.instance';
    id: string;
    status: 'draft' | 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
    metadata: Record<string, any> | null;
    integrationId: string;
    identityActorId: string | null;
    identityId: string | null;
    implementation: {
      type: 'magic_mcp_server';
      magicMcpServerId: string;
    } | null;
    providers: {
      object: 'integration.instance.provider';
      id: string;
      status: 'active' | 'archived' | 'deleted';
      name: string;
      description: string | null;
      metadata: Record<string, any> | null;
      integrationId: string;
      integrationInstanceId: string;
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
          }
        | null;
      isOverrideToolFilter: boolean;
      provider: {
        object: 'provider#preview';
        id: string;
        name: string;
        description: string | null;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
      };
      integrationProvider: {
        object: 'integration.provider#snapshot';
        id: string;
        providerVersion: {
          object: 'integration.provider.version';
          id: string;
          index: number;
        };
        status: 'active' | 'archived' | 'deleted';
        name: string;
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
            }
          | null;
        providerId: string;
        deploymentId: string;
        authMethodId: string | null;
        authCredentialsId: string | null;
        config: {
          object: 'provider.config#preview';
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
        archivedAt: Date | null;
      };
      config: {
        object: 'provider.config#preview';
        id: string;
        isDefault: boolean;
        name: string | null;
        description: string | null;
        metadata: Record<string, any> | null;
        providerId: string;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      authConfig: {
        object: 'provider.auth_config#preview';
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
      archivedAt: Date | null;
    }[];
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceIntegrationsInstancesListOutput =
  mtMap.object<DashboardInstanceIntegrationsInstancesListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          integrationId: mtMap.objectField(
            'integration_id',
            mtMap.passthrough()
          ),
          identityActorId: mtMap.objectField(
            'identity_actor_id',
            mtMap.passthrough()
          ),
          identityId: mtMap.objectField('identity_id', mtMap.passthrough()),
          implementation: mtMap.objectField(
            'implementation',
            mtMap.object({
              type: mtMap.objectField('type', mtMap.passthrough()),
              magicMcpServerId: mtMap.objectField(
                'magic_mcp_server_id',
                mtMap.passthrough()
              )
            })
          ),
          providers: mtMap.objectField(
            'providers',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                ),
                metadata: mtMap.objectField('metadata', mtMap.passthrough()),
                integrationId: mtMap.objectField(
                  'integration_id',
                  mtMap.passthrough()
                ),
                integrationInstanceId: mtMap.objectField(
                  'integration_instance_id',
                  mtMap.passthrough()
                ),
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
                isOverrideToolFilter: mtMap.objectField(
                  'is_override_tool_filter',
                  mtMap.passthrough()
                ),
                provider: mtMap.objectField(
                  'provider',
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    name: mtMap.objectField('name', mtMap.passthrough()),
                    description: mtMap.objectField(
                      'description',
                      mtMap.passthrough()
                    ),
                    slug: mtMap.objectField('slug', mtMap.passthrough()),
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date())
                  })
                ),
                integrationProvider: mtMap.objectField(
                  'integration_provider',
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    providerVersion: mtMap.objectField(
                      'provider_version',
                      mtMap.object({
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
                        id: mtMap.objectField('id', mtMap.passthrough()),
                        index: mtMap.objectField('index', mtMap.passthrough())
                      })
                    ),
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
                    toolFilter: mtMap.objectField(
                      'tool_filter',
                      mtMap.union([
                        mtMap.unionOption(
                          'object',
                          mtMap.object({
                            type: mtMap.objectField(
                              'type',
                              mtMap.passthrough()
                            ),
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
                    providerId: mtMap.objectField(
                      'provider_id',
                      mtMap.passthrough()
                    ),
                    deploymentId: mtMap.objectField(
                      'deployment_id',
                      mtMap.passthrough()
                    ),
                    authMethodId: mtMap.objectField(
                      'auth_method_id',
                      mtMap.passthrough()
                    ),
                    authCredentialsId: mtMap.objectField(
                      'auth_credentials_id',
                      mtMap.passthrough()
                    ),
                    config: mtMap.objectField(
                      'config',
                      mtMap.object({
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
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
                        metadata: mtMap.objectField(
                          'metadata',
                          mtMap.passthrough()
                        ),
                        providerId: mtMap.objectField(
                          'provider_id',
                          mtMap.passthrough()
                        ),
                        createdAt: mtMap.objectField(
                          'created_at',
                          mtMap.date()
                        ),
                        updatedAt: mtMap.objectField('updated_at', mtMap.date())
                      })
                    ),
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
                    archivedAt: mtMap.objectField('archived_at', mtMap.date())
                  })
                ),
                config: mtMap.objectField(
                  'config',
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
                    metadata: mtMap.objectField(
                      'metadata',
                      mtMap.passthrough()
                    ),
                    providerId: mtMap.objectField(
                      'provider_id',
                      mtMap.passthrough()
                    ),
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date())
                  })
                ),
                authConfig: mtMap.objectField(
                  'auth_config',
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
                    metadata: mtMap.objectField(
                      'metadata',
                      mtMap.passthrough()
                    ),
                    providerId: mtMap.objectField(
                      'provider_id',
                      mtMap.passthrough()
                    ),
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date())
                  })
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date()),
                archivedAt: mtMap.objectField('archived_at', mtMap.date())
              })
            )
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date()),
          archivedAt: mtMap.objectField('archived_at', mtMap.date())
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

export type DashboardInstanceIntegrationsInstancesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  status?:
    | 'draft'
    | 'active'
    | 'archived'
    | 'deleted'
    | ('draft' | 'active' | 'archived' | 'deleted')[]
    | undefined;
  id?: string | string[] | undefined;
  integrationId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  integrationProviderId?: string | string[] | undefined;
  identityId?: string | string[] | undefined;
  identityCredentialId?: string | string[] | undefined;
  identityActorId?: string | string[] | undefined;
  providerDeploymentId?: string | string[] | undefined;
  providerConfigId?: string | string[] | undefined;
  providerAuthConfigId?: string | string[] | undefined;
  sessionTemplateId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceIntegrationsInstancesListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      search: mtMap.objectField('search', mtMap.passthrough()),
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
      integrationProviderId: mtMap.objectField(
        'integration_provider_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      identityId: mtMap.objectField(
        'identity_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      identityCredentialId: mtMap.objectField(
        'identity_credential_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      identityActorId: mtMap.objectField(
        'identity_actor_id',
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
      providerConfigId: mtMap.objectField(
        'provider_config_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerAuthConfigId: mtMap.objectField(
        'provider_auth_config_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      sessionTemplateId: mtMap.objectField(
        'session_template_id',
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

