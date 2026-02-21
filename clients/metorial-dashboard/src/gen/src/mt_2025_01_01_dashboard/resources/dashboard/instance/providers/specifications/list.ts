import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProvidersSpecificationsListOutput = {
  items: {
    object: 'provider.specification';
    id: string;
    name: string;
    description: string | null;
    configSchema: Record<string, any> | null;
    tools: {
      object: 'provider.tool';
      id: string;
      name: string;
      title: string | null;
      description: string | null;
      inputSchema: Record<string, any> | null;
      outputSchema: Record<string, any> | null;
      providerId: string;
      providerSpecificationId: string;
      createdAt: Date;
      updatedAt: Date;
    }[];
    authMethods: {
      object: 'provider.auth_method';
      id: string;
      type: 'oauth' | 'token' | 'custom';
      name: string;
      description: string | null;
      inputSchema: Record<string, any> | null;
      scopes:
        | {
            object: 'provider.auth_method.scope';
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

export let mapDashboardInstanceProvidersSpecificationsListOutput =
  mtMap.object<DashboardInstanceProvidersSpecificationsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          configSchema: mtMap.objectField('config_schema', mtMap.passthrough()),
          tools: mtMap.objectField(
            'tools',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                title: mtMap.objectField('title', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                ),
                inputSchema: mtMap.objectField(
                  'input_schema',
                  mtMap.passthrough()
                ),
                outputSchema: mtMap.objectField(
                  'output_schema',
                  mtMap.passthrough()
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
          authMethods: mtMap.objectField(
            'auth_methods',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                type: mtMap.objectField('type', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                ),
                inputSchema: mtMap.objectField(
                  'input_schema',
                  mtMap.passthrough()
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

export type DashboardInstanceProvidersSpecificationsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceProvidersSpecificationsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough())
    })
  )
]);

