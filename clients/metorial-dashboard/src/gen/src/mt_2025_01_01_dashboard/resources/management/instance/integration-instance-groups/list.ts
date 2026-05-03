import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceIntegrationInstanceGroupsListOutput = {
  items: {
    object: 'integration.instance.group';
    id: string;
    status: 'draft' | 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
    metadata: Record<string, any> | null;
    implementation: {
      type: 'magic_mcp_endpoint';
      magicMcpEndpointBackingId: string;
    } | null;
    providers: {
      object: 'integration.instance.group.provider';
      id: string;
      status: 'active' | 'archived' | 'deleted';
      name: string;
      description: string | null;
      metadata: Record<string, any> | null;
      integrationInstanceGroupId: string;
      integrationId: string;
      integrationInstanceId: string;
      integrationProviderId: string;
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
        provider: {
          object: 'provider#preview';
          id: string;
          name: string;
          description: string | null;
          slug: string;
          createdAt: Date;
          updatedAt: Date;
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
        };
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
        } | null;
        authCredentials: {
          object: 'provider.auth_credentials';
          id: string;
          type: 'oauth';
          status: 'active' | 'archived' | 'deleted';
          isDefault: boolean;
          isManaged: boolean;
          name: string | null;
          description: string | null;
          metadata: Record<string, any> | null;
          scopes: string[] | null;
          providerId: string;
          createdAt: Date;
          updatedAt: Date;
        } | null;
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
      } | null;
      integrationInstanceProvider: {
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
          provider: {
            object: 'provider#preview';
            id: string;
            name: string;
            description: string | null;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
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
          };
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
          } | null;
          authCredentials: {
            object: 'provider.auth_credentials';
            id: string;
            type: 'oauth';
            status: 'active' | 'archived' | 'deleted';
            isDefault: boolean;
            isManaged: boolean;
            name: string | null;
            description: string | null;
            metadata: Record<string, any> | null;
            scopes: string[] | null;
            providerId: string;
            createdAt: Date;
            updatedAt: Date;
          } | null;
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
      };
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

export let mapManagementInstanceIntegrationInstanceGroupsListOutput =
  mtMap.object<ManagementInstanceIntegrationInstanceGroupsListOutput>({
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
          implementation: mtMap.objectField(
            'implementation',
            mtMap.object({
              type: mtMap.objectField('type', mtMap.passthrough()),
              magicMcpEndpointBackingId: mtMap.objectField(
                'magic_mcp_endpoint_backing_id',
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
                integrationInstanceGroupId: mtMap.objectField(
                  'integration_instance_group_id',
                  mtMap.passthrough()
                ),
                integrationId: mtMap.objectField(
                  'integration_id',
                  mtMap.passthrough()
                ),
                integrationInstanceId: mtMap.objectField(
                  'integration_instance_id',
                  mtMap.passthrough()
                ),
                integrationProviderId: mtMap.objectField(
                  'integration_provider_id',
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
                    provider: mtMap.objectField(
                      'provider',
                      mtMap.object({
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
                        id: mtMap.objectField('id', mtMap.passthrough()),
                        name: mtMap.objectField('name', mtMap.passthrough()),
                        description: mtMap.objectField(
                          'description',
                          mtMap.passthrough()
                        ),
                        slug: mtMap.objectField('slug', mtMap.passthrough()),
                        createdAt: mtMap.objectField(
                          'created_at',
                          mtMap.date()
                        ),
                        updatedAt: mtMap.objectField('updated_at', mtMap.date())
                      })
                    ),
                    deployment: mtMap.objectField(
                      'deployment',
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
                    authMethod: mtMap.objectField(
                      'auth_method',
                      mtMap.object({
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
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
                            type: mtMap.objectField(
                              'type',
                              mtMap.passthrough()
                            ),
                            schema: mtMap.objectField(
                              'schema',
                              mtMap.passthrough()
                            )
                          })
                        ),
                        outputSchema: mtMap.objectField(
                          'output_schema',
                          mtMap.object({
                            type: mtMap.objectField(
                              'type',
                              mtMap.passthrough()
                            ),
                            schema: mtMap.objectField(
                              'schema',
                              mtMap.passthrough()
                            )
                          })
                        ),
                        scopes: mtMap.objectField(
                          'scopes',
                          mtMap.array(
                            mtMap.object({
                              object: mtMap.objectField(
                                'object',
                                mtMap.passthrough()
                              ),
                              id: mtMap.objectField('id', mtMap.passthrough()),
                              scope: mtMap.objectField(
                                'scope',
                                mtMap.passthrough()
                              ),
                              name: mtMap.objectField(
                                'name',
                                mtMap.passthrough()
                              ),
                              description: mtMap.objectField(
                                'description',
                                mtMap.passthrough()
                              )
                            })
                          )
                        ),
                        providerId: mtMap.objectField(
                          'provider_id',
                          mtMap.passthrough()
                        ),
                        providerSpecificationId: mtMap.objectField(
                          'provider_specification_id',
                          mtMap.passthrough()
                        ),
                        createdAt: mtMap.objectField(
                          'created_at',
                          mtMap.date()
                        ),
                        updatedAt: mtMap.objectField('updated_at', mtMap.date())
                      })
                    ),
                    authCredentials: mtMap.objectField(
                      'auth_credentials',
                      mtMap.object({
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
                        id: mtMap.objectField('id', mtMap.passthrough()),
                        type: mtMap.objectField('type', mtMap.passthrough()),
                        status: mtMap.objectField(
                          'status',
                          mtMap.passthrough()
                        ),
                        isDefault: mtMap.objectField(
                          'is_default',
                          mtMap.passthrough()
                        ),
                        isManaged: mtMap.objectField(
                          'is_managed',
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
                        scopes: mtMap.objectField(
                          'scopes',
                          mtMap.array(mtMap.passthrough())
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
                integrationInstanceProvider: mtMap.objectField(
                  'integration_instance_provider',
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
                    isOverrideToolFilter: mtMap.objectField(
                      'is_override_tool_filter',
                      mtMap.passthrough()
                    ),
                    provider: mtMap.objectField(
                      'provider',
                      mtMap.object({
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
                        id: mtMap.objectField('id', mtMap.passthrough()),
                        name: mtMap.objectField('name', mtMap.passthrough()),
                        description: mtMap.objectField(
                          'description',
                          mtMap.passthrough()
                        ),
                        slug: mtMap.objectField('slug', mtMap.passthrough()),
                        createdAt: mtMap.objectField(
                          'created_at',
                          mtMap.date()
                        ),
                        updatedAt: mtMap.objectField('updated_at', mtMap.date())
                      })
                    ),
                    integrationProvider: mtMap.objectField(
                      'integration_provider',
                      mtMap.object({
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
                        id: mtMap.objectField('id', mtMap.passthrough()),
                        providerVersion: mtMap.objectField(
                          'provider_version',
                          mtMap.object({
                            object: mtMap.objectField(
                              'object',
                              mtMap.passthrough()
                            ),
                            id: mtMap.objectField('id', mtMap.passthrough()),
                            index: mtMap.objectField(
                              'index',
                              mtMap.passthrough()
                            )
                          })
                        ),
                        status: mtMap.objectField(
                          'status',
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
                        provider: mtMap.objectField(
                          'provider',
                          mtMap.object({
                            object: mtMap.objectField(
                              'object',
                              mtMap.passthrough()
                            ),
                            id: mtMap.objectField('id', mtMap.passthrough()),
                            name: mtMap.objectField(
                              'name',
                              mtMap.passthrough()
                            ),
                            description: mtMap.objectField(
                              'description',
                              mtMap.passthrough()
                            ),
                            slug: mtMap.objectField(
                              'slug',
                              mtMap.passthrough()
                            ),
                            createdAt: mtMap.objectField(
                              'created_at',
                              mtMap.date()
                            ),
                            updatedAt: mtMap.objectField(
                              'updated_at',
                              mtMap.date()
                            )
                          })
                        ),
                        deployment: mtMap.objectField(
                          'deployment',
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
                            name: mtMap.objectField(
                              'name',
                              mtMap.passthrough()
                            ),
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
                            updatedAt: mtMap.objectField(
                              'updated_at',
                              mtMap.date()
                            )
                          })
                        ),
                        authMethod: mtMap.objectField(
                          'auth_method',
                          mtMap.object({
                            object: mtMap.objectField(
                              'object',
                              mtMap.passthrough()
                            ),
                            id: mtMap.objectField('id', mtMap.passthrough()),
                            type: mtMap.objectField(
                              'type',
                              mtMap.passthrough()
                            ),
                            key: mtMap.objectField('key', mtMap.passthrough()),
                            name: mtMap.objectField(
                              'name',
                              mtMap.passthrough()
                            ),
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
                                type: mtMap.objectField(
                                  'type',
                                  mtMap.passthrough()
                                ),
                                schema: mtMap.objectField(
                                  'schema',
                                  mtMap.passthrough()
                                )
                              })
                            ),
                            outputSchema: mtMap.objectField(
                              'output_schema',
                              mtMap.object({
                                type: mtMap.objectField(
                                  'type',
                                  mtMap.passthrough()
                                ),
                                schema: mtMap.objectField(
                                  'schema',
                                  mtMap.passthrough()
                                )
                              })
                            ),
                            scopes: mtMap.objectField(
                              'scopes',
                              mtMap.array(
                                mtMap.object({
                                  object: mtMap.objectField(
                                    'object',
                                    mtMap.passthrough()
                                  ),
                                  id: mtMap.objectField(
                                    'id',
                                    mtMap.passthrough()
                                  ),
                                  scope: mtMap.objectField(
                                    'scope',
                                    mtMap.passthrough()
                                  ),
                                  name: mtMap.objectField(
                                    'name',
                                    mtMap.passthrough()
                                  ),
                                  description: mtMap.objectField(
                                    'description',
                                    mtMap.passthrough()
                                  )
                                })
                              )
                            ),
                            providerId: mtMap.objectField(
                              'provider_id',
                              mtMap.passthrough()
                            ),
                            providerSpecificationId: mtMap.objectField(
                              'provider_specification_id',
                              mtMap.passthrough()
                            ),
                            createdAt: mtMap.objectField(
                              'created_at',
                              mtMap.date()
                            ),
                            updatedAt: mtMap.objectField(
                              'updated_at',
                              mtMap.date()
                            )
                          })
                        ),
                        authCredentials: mtMap.objectField(
                          'auth_credentials',
                          mtMap.object({
                            object: mtMap.objectField(
                              'object',
                              mtMap.passthrough()
                            ),
                            id: mtMap.objectField('id', mtMap.passthrough()),
                            type: mtMap.objectField(
                              'type',
                              mtMap.passthrough()
                            ),
                            status: mtMap.objectField(
                              'status',
                              mtMap.passthrough()
                            ),
                            isDefault: mtMap.objectField(
                              'is_default',
                              mtMap.passthrough()
                            ),
                            isManaged: mtMap.objectField(
                              'is_managed',
                              mtMap.passthrough()
                            ),
                            name: mtMap.objectField(
                              'name',
                              mtMap.passthrough()
                            ),
                            description: mtMap.objectField(
                              'description',
                              mtMap.passthrough()
                            ),
                            metadata: mtMap.objectField(
                              'metadata',
                              mtMap.passthrough()
                            ),
                            scopes: mtMap.objectField(
                              'scopes',
                              mtMap.array(mtMap.passthrough())
                            ),
                            providerId: mtMap.objectField(
                              'provider_id',
                              mtMap.passthrough()
                            ),
                            createdAt: mtMap.objectField(
                              'created_at',
                              mtMap.date()
                            ),
                            updatedAt: mtMap.objectField(
                              'updated_at',
                              mtMap.date()
                            )
                          })
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
                            name: mtMap.objectField(
                              'name',
                              mtMap.passthrough()
                            ),
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
                            updatedAt: mtMap.objectField(
                              'updated_at',
                              mtMap.date()
                            )
                          })
                        ),
                        createdAt: mtMap.objectField(
                          'created_at',
                          mtMap.date()
                        ),
                        updatedAt: mtMap.objectField(
                          'updated_at',
                          mtMap.date()
                        ),
                        archivedAt: mtMap.objectField(
                          'archived_at',
                          mtMap.date()
                        )
                      })
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
                    authConfig: mtMap.objectField(
                      'auth_config',
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

export type ManagementInstanceIntegrationInstanceGroupsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'draft'
    | 'active'
    | 'archived'
    | 'deleted'
    | ('draft' | 'active' | 'archived' | 'deleted')[]
    | undefined;
  id?: string | string[] | undefined;
  integrationId?: string | string[] | undefined;
  integrationInstanceId?: string | string[] | undefined;
  integrationInstanceProviderId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  integrationProviderId?: string | string[] | undefined;
  providerDeploymentId?: string | string[] | undefined;
  providerConfigId?: string | string[] | undefined;
  providerAuthConfigId?: string | string[] | undefined;
  sessionTemplateId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapManagementInstanceIntegrationInstanceGroupsListQuery =
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
        integrationInstanceId: mtMap.objectField(
          'integration_instance_id',
          mtMap.union([
            mtMap.unionOption('string', mtMap.passthrough()),
            mtMap.unionOption(
              'array',
              mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
            )
          ])
        ),
        integrationInstanceProviderId: mtMap.objectField(
          'integration_instance_provider_id',
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

