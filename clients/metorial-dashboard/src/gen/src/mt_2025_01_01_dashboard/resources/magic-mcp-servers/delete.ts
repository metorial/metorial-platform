import { mtMap } from '@metorial/util-resource-mapper';

export type MagicMcpServersDeleteOutput = {
  object: 'magic_mcp.server';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  source: 'manual' | 'consumer_provider_template';
  providerManagementMode: 'manual' | 'inherited_from_provider_template';
  providerTemplateId: string | null;
  providerTemplateBackingId: string | null;
  integrationId: string | null;
  integrationInstanceId: string | null;
  endpoints: { id: string; alias: string; url: string }[];
  integration: {
    object: 'integration';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    slug: string;
    name: string;
    description: string | null;
    metadata: Record<string, any> | null;
    configuration: {
      canAttachCustomToolFilters: boolean;
      canAttachCustomProviderConfig: boolean;
      canOverrideToolFilters: boolean;
    };
    implementation:
      | { type: 'provider_template'; providerTemplateId: string }
      | { type: 'magic_mcp_server'; magicMcpServerId: string }
      | null;
    providers: {
      object: 'integration.provider';
      id: string;
      status: 'active' | 'archived' | 'deleted';
      integrationId: string;
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
    }[];
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
  } | null;
  integrationInstance: {
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
    }[];
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
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
  }[];
  name: string | null;
  description: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
} & {};

export let mapMagicMcpServersDeleteOutput = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      status: mtMap.objectField('status', mtMap.passthrough()),
      source: mtMap.objectField('source', mtMap.passthrough()),
      providerManagementMode: mtMap.objectField(
        'provider_management_mode',
        mtMap.passthrough()
      ),
      providerTemplateId: mtMap.objectField(
        'provider_template_id',
        mtMap.passthrough()
      ),
      providerTemplateBackingId: mtMap.objectField(
        'provider_template_backing_id',
        mtMap.passthrough()
      ),
      integrationId: mtMap.objectField('integration_id', mtMap.passthrough()),
      integrationInstanceId: mtMap.objectField(
        'integration_instance_id',
        mtMap.passthrough()
      ),
      endpoints: mtMap.objectField(
        'endpoints',
        mtMap.array(
          mtMap.object({
            id: mtMap.objectField('id', mtMap.passthrough()),
            alias: mtMap.objectField('alias', mtMap.passthrough()),
            url: mtMap.objectField('url', mtMap.passthrough())
          })
        )
      ),
      integration: mtMap.objectField(
        'integration',
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
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
          implementation: mtMap.objectField(
            'implementation',
            mtMap.union([
              mtMap.unionOption(
                'object',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  providerTemplateId: mtMap.objectField(
                    'provider_template_id',
                    mtMap.passthrough()
                  ),
                  magicMcpServerId: mtMap.objectField(
                    'magic_mcp_server_id',
                    mtMap.passthrough()
                  )
                })
              )
            ])
          ),
          providers: mtMap.objectField(
            'providers',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough()),
                integrationId: mtMap.objectField(
                  'integration_id',
                  mtMap.passthrough()
                ),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                ),
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
                          object: mtMap.objectField(
                            'object',
                            mtMap.passthrough()
                          ),
                          id: mtMap.objectField('id', mtMap.passthrough()),
                          scope: mtMap.objectField(
                            'scope',
                            mtMap.passthrough()
                          ),
                          name: mtMap.objectField('name', mtMap.passthrough()),
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
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date())
                  })
                ),
                authCredentials: mtMap.objectField(
                  'auth_credentials',
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    type: mtMap.objectField('type', mtMap.passthrough()),
                    status: mtMap.objectField('status', mtMap.passthrough()),
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
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date())
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
      ),
      integrationInstance: mtMap.objectField(
        'integration_instance',
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
      ),
      providers: mtMap.objectField(
        'providers',
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
                    object: mtMap.objectField('object', mtMap.passthrough()),
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
                          object: mtMap.objectField(
                            'object',
                            mtMap.passthrough()
                          ),
                          id: mtMap.objectField('id', mtMap.passthrough()),
                          scope: mtMap.objectField(
                            'scope',
                            mtMap.passthrough()
                          ),
                          name: mtMap.objectField('name', mtMap.passthrough()),
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
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date())
                  })
                ),
                authCredentials: mtMap.objectField(
                  'auth_credentials',
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    type: mtMap.objectField('type', mtMap.passthrough()),
                    status: mtMap.objectField('status', mtMap.passthrough()),
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
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date())
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
            authConfig: mtMap.objectField(
              'auth_config',
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
            updatedAt: mtMap.objectField('updated_at', mtMap.date()),
            archivedAt: mtMap.objectField('archived_at', mtMap.date())
          })
        )
      ),
      name: mtMap.objectField('name', mtMap.passthrough()),
      description: mtMap.objectField('description', mtMap.passthrough()),
      metadata: mtMap.objectField('metadata', mtMap.passthrough()),
      createdAt: mtMap.objectField('created_at', mtMap.date()),
      updatedAt: mtMap.objectField('updated_at', mtMap.date())
    })
  )
]);

