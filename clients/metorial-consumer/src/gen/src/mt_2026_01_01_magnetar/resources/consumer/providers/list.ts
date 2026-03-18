import { mtMap } from '@metorial/util-resource-mapper';

export type ConsumerProvidersListOutput = {
  items: (
    | {
        object: 'consumer.provider';
        id: string;
        type: 'provider_template';
        availability: 'available_now' | 'request_access';
        providerTemplate: {
          object: 'provider.template#preview';
          id: string;
          status: 'active' | 'archived' | 'deleted';
          name: string;
          description: string | null;
          metadata: Record<string, any>;
          providerDeploymentId: string;
        };
        provider: {
          object: 'provider';
          id: string;
          access: 'public' | 'tenant';
          status: 'active' | 'archived' | 'deleted';
          publisher: {
            object: 'provider.publisher';
            id: string;
            name: string;
            description: string | null;
            imageUrl: string;
            createdAt: Date;
            updatedAt: Date;
          };
          currentVersion: {
            object: 'provider.version';
            id: string;
            version: string;
            providerId: string;
            isCurrent: boolean;
            name: string;
            description: string | null;
            metadata: Record<string, any> | null;
            specificationId: string | null;
            createdAt: Date;
            updatedAt: Date;
          } | null;
          oauth: {
            status: 'enabled' | 'disabled';
            callbackUrl: string | null;
            autoRegistration: { status: 'supported' | 'unsupported' };
          } | null;
          identifier: string;
          name: string;
          description: string | null;
          slug: string;
          metadata: Record<string, any> | null;
          createdAt: Date;
          updatedAt: Date;
        };
        deployment: {
          object: 'provider.deployment#preview';
          id: string;
          name: string | null;
          description: string | null;
          isDefault: boolean;
          providerId: string;
          lockedVersionId: string | null;
        };
        configSchema: {
          type: 'json_schema';
          schema: Record<string, any>;
        } | null;
        authMethods: {
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
        }[];
      }
    | {
        object: 'consumer.provider';
        id: string;
        type: 'magic_mcp_server';
        availability: 'available_now' | 'request_access';
        magicMcpServer: {
          object: 'magic_mcp.server#preview';
          id: string;
          status: 'active' | 'archived' | 'deleted';
          name: string | null;
          description: string | null;
        };
      }
  )[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapConsumerProvidersListOutput =
  mtMap.object<ConsumerProvidersListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.union([
          mtMap.unionOption(
            'object',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              type: mtMap.objectField('type', mtMap.passthrough()),
              availability: mtMap.objectField(
                'availability',
                mtMap.passthrough()
              ),
              providerTemplate: mtMap.objectField(
                'provider_template',
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
                  providerDeploymentId: mtMap.objectField(
                    'provider_deployment_id',
                    mtMap.passthrough()
                  )
                })
              ),
              provider: mtMap.objectField(
                'provider',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  access: mtMap.objectField('access', mtMap.passthrough()),
                  status: mtMap.objectField('status', mtMap.passthrough()),
                  publisher: mtMap.objectField(
                    'publisher',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      description: mtMap.objectField(
                        'description',
                        mtMap.passthrough()
                      ),
                      imageUrl: mtMap.objectField(
                        'image_url',
                        mtMap.passthrough()
                      ),
                      createdAt: mtMap.objectField('created_at', mtMap.date()),
                      updatedAt: mtMap.objectField('updated_at', mtMap.date())
                    })
                  ),
                  currentVersion: mtMap.objectField(
                    'current_version',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      version: mtMap.objectField(
                        'version',
                        mtMap.passthrough()
                      ),
                      providerId: mtMap.objectField(
                        'provider_id',
                        mtMap.passthrough()
                      ),
                      isCurrent: mtMap.objectField(
                        'is_current',
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
                      specificationId: mtMap.objectField(
                        'specification_id',
                        mtMap.passthrough()
                      ),
                      createdAt: mtMap.objectField('created_at', mtMap.date()),
                      updatedAt: mtMap.objectField('updated_at', mtMap.date())
                    })
                  ),
                  oauth: mtMap.objectField(
                    'oauth',
                    mtMap.object({
                      status: mtMap.objectField('status', mtMap.passthrough()),
                      callbackUrl: mtMap.objectField(
                        'callback_url',
                        mtMap.passthrough()
                      ),
                      autoRegistration: mtMap.objectField(
                        'auto_registration',
                        mtMap.object({
                          status: mtMap.objectField(
                            'status',
                            mtMap.passthrough()
                          )
                        })
                      )
                    })
                  ),
                  identifier: mtMap.objectField(
                    'identifier',
                    mtMap.passthrough()
                  ),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  slug: mtMap.objectField('slug', mtMap.passthrough()),
                  metadata: mtMap.objectField('metadata', mtMap.passthrough()),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              ),
              deployment: mtMap.objectField(
                'deployment',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  isDefault: mtMap.objectField(
                    'is_default',
                    mtMap.passthrough()
                  ),
                  providerId: mtMap.objectField(
                    'provider_id',
                    mtMap.passthrough()
                  ),
                  lockedVersionId: mtMap.objectField(
                    'locked_version_id',
                    mtMap.passthrough()
                  )
                })
              ),
              configSchema: mtMap.objectField(
                'config_schema',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  schema: mtMap.objectField('schema', mtMap.passthrough())
                })
              ),
              authMethods: mtMap.objectField(
                'auth_methods',
                mtMap.array(
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
                )
              ),
              magicMcpServer: mtMap.objectField(
                'magic_mcp_server',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  status: mtMap.objectField('status', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  )
                })
              )
            })
          )
        ])
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

export type ConsumerProvidersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { search?: string | undefined };

export let mapConsumerProvidersListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      search: mtMap.objectField('search', mtMap.passthrough())
    })
  )
]);

