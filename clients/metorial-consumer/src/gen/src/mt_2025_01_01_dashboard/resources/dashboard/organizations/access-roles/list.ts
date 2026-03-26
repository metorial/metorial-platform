import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsAccessRolesListOutput = {
  items: {
    object: 'management.access_role';
    id: string;
    organizationId: string;
    name: string;
    slug: string;
    description: string | null;
    isAdmin: boolean;
    scopes: string[];
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsAccessRolesListOutput =
  mtMap.object<DashboardOrganizationsAccessRolesListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          organizationId: mtMap.objectField(
            'organization_id',
            mtMap.passthrough()
          ),
          name: mtMap.objectField('name', mtMap.passthrough()),
          slug: mtMap.objectField('slug', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          isAdmin: mtMap.objectField('is_admin', mtMap.passthrough()),
          scopes: mtMap.objectField('scopes', mtMap.array(mtMap.passthrough())),
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

export type DashboardOrganizationsAccessRolesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardOrganizationsAccessRolesListQuery = mtMap.union([
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

