import { mtMap } from '@metorial/util-resource-mapper';

export type ProvidersAuthMethodsListOutput = {
  items: {
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
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapProvidersAuthMethodsListOutput =
  mtMap.object<ProvidersAuthMethodsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
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

export type ProvidersAuthMethodsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { providerVersionId: string };

export let mapProvidersAuthMethodsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      providerVersionId: mtMap.objectField(
        'provider_version_id',
        mtMap.passthrough()
      )
    })
  )
]);

