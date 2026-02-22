import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProvidersSpecificationsListOutput = {
  items: {
    object: 'provider.specification';
    id: string;
    key: string;
    name: string;
    description: string | null;
    configSchema: Record<string, any>;
    configVisibility: 'encrypted' | 'plain';
    tools: {
      object: 'provider.tool';
      id: string;
      key: string;
      name: string;
      description: string | null;
      capabilities: Record<string, any>;
      constraints: string[];
      instructions: string[];
      inputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
      outputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
      tags: {
        destructive?: boolean | undefined;
        readOnly?: boolean | undefined;
      } | null;
      specificationId: string;
      providerId: string;
      createdAt: Date;
      updatedAt: Date;
    }[];
    authMethods: {
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
    }[];
    providerId: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceProvidersSpecificationsListOutput =
  mtMap.object<ManagementInstanceProvidersSpecificationsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          key: mtMap.objectField('key', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          configSchema: mtMap.objectField('config_schema', mtMap.passthrough()),
          configVisibility: mtMap.objectField(
            'config_visibility',
            mtMap.passthrough()
          ),
          tools: mtMap.objectField(
            'tools',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
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
                constraints: mtMap.objectField(
                  'constraints',
                  mtMap.array(mtMap.passthrough())
                ),
                instructions: mtMap.objectField(
                  'instructions',
                  mtMap.array(mtMap.passthrough())
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
                tags: mtMap.objectField(
                  'tags',
                  mtMap.object({
                    destructive: mtMap.objectField(
                      'destructive',
                      mtMap.passthrough()
                    ),
                    readOnly: mtMap.objectField('readOnly', mtMap.passthrough())
                  })
                ),
                specificationId: mtMap.objectField(
                  'specification_id',
                  mtMap.passthrough()
                ),
                providerId: mtMap.objectField(
                  'provider_id',
                  mtMap.passthrough()
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            )
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
          providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
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

export type ManagementInstanceProvidersSpecificationsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerVersionId?: string | string[] | undefined;
  providerDeploymentId?: string | string[] | undefined;
  providerConfigId?: string | string[] | undefined;
};

export let mapManagementInstanceProvidersSpecificationsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
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
      providerVersionId: mtMap.objectField(
        'provider_version_id',
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
      )
    })
  )
]);

