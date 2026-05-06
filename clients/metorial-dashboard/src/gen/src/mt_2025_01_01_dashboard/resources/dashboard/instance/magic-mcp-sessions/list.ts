import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceMagicMcpSessionsListOutput = {
  items: {
    object: 'magic_mcp.session';
    id: string;
    magicMcpServer: {
      object: 'magic_mcp.server';
      id: string;
      status: 'active' | 'archived' | 'deleted';
      source: 'manual' | 'consumer_provider_template';
      providerManagementMode:
        | 'manual'
        | 'inherited_from_provider_template'
        | 'inherited_from_integration';
      endpoints: { id: string; alias: string; url: string }[];
      providerTemplateId: string | null;
      providers: {
        object: 'magic_mcp.server.provider';
        id: string;
        status: 'pending' | 'active' | 'archived' | 'deleted';
        magicMcpServerId: string;
        providerManagementMode:
          | 'manual'
          | 'inherited_from_provider_template'
          | 'inherited_from_integration';
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
    } | null;
    magicMcpEndpoint: {
      object: 'magic_mcp.endpoint';
      id: string;
      status: 'active' | 'archived' | 'deleted';
      slug: string;
      url: string;
      servers: ({
        object: 'magic_mcp.server#preview';
        id: string;
        status: 'active' | 'archived' | 'deleted';
        name: string | null;
        description: string | null;
      } & {
        toolFilters:
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
          | null;
      })[];
      name: string | null;
      description: string | null;
      metadata: Record<string, any>;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    consumerProfileId: string | null;
    consumerIntegrationIds: string[];
    sessionId: string;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceMagicMcpSessionsListOutput =
  mtMap.object<DashboardInstanceMagicMcpSessionsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          magicMcpServer: mtMap.objectField(
            'magic_mcp_server',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              source: mtMap.objectField('source', mtMap.passthrough()),
              providerManagementMode: mtMap.objectField(
                'provider_management_mode',
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
              providerTemplateId: mtMap.objectField(
                'provider_template_id',
                mtMap.passthrough()
              ),
              providers: mtMap.objectField(
                'providers',
                mtMap.array(
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    status: mtMap.objectField('status', mtMap.passthrough()),
                    magicMcpServerId: mtMap.objectField(
                      'magic_mcp_server_id',
                      mtMap.passthrough()
                    ),
                    providerManagementMode: mtMap.objectField(
                      'provider_management_mode',
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
                )
              ),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          magicMcpEndpoint: mtMap.objectField(
            'magic_mcp_endpoint',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              slug: mtMap.objectField('slug', mtMap.passthrough()),
              url: mtMap.objectField('url', mtMap.passthrough()),
              servers: mtMap.objectField(
                'servers',
                mtMap.array(
                  mtMap.union([
                    mtMap.unionOption(
                      'object',
                      mtMap.object({
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
                        id: mtMap.objectField('id', mtMap.passthrough()),
                        status: mtMap.objectField(
                          'status',
                          mtMap.passthrough()
                        ),
                        name: mtMap.objectField('name', mtMap.passthrough()),
                        description: mtMap.objectField(
                          'description',
                          mtMap.passthrough()
                        ),
                        toolFilters: mtMap.objectField(
                          'tool_filters',
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
                            ),
                            mtMap.unionOption(
                              'array',
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
                          ])
                        )
                      })
                    )
                  ])
                )
              ),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          consumerProfileId: mtMap.objectField(
            'consumer_profile_id',
            mtMap.passthrough()
          ),
          consumerIntegrationIds: mtMap.objectField(
            'consumer_integration_ids',
            mtMap.array(mtMap.passthrough())
          ),
          sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
          expiresAt: mtMap.objectField('expires_at', mtMap.date()),
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

export type DashboardInstanceMagicMcpSessionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { magicMcpServerId?: string | string[] | undefined };

export let mapDashboardInstanceMagicMcpSessionsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      magicMcpServerId: mtMap.objectField(
        'magic_mcp_server_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      )
    })
  )
]);

