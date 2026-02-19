import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProvidersAuthMethodsListOutput = {
  items: {
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
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceProvidersAuthMethodsListOutput =
  mtMap.object<DashboardInstanceProvidersAuthMethodsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          inputSchema: mtMap.objectField('input_schema', mtMap.passthrough()),
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
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField('has_more_before', mtMap.passthrough()),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type DashboardInstanceProvidersAuthMethodsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { providerVersionId?: string | undefined };

export let mapDashboardInstanceProvidersAuthMethodsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      providerVersionId: mtMap.objectField('provider_version_id', mtMap.passthrough())
    })
  )
]);
