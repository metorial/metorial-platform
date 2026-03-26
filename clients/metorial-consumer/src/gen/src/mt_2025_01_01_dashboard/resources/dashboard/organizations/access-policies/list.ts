import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsAccessPoliciesListOutput = {
  items: {
    object: 'management.access_policy';
    id: string;
    organizationId: string;
    type: 'everyone' | 'admin' | 'custom';
    name: string;
    slug: string;
    description: string | null;
    document: {
      access: {
        target: string;
        scopes?: string[] | undefined;
        roles?: string[] | undefined;
      }[];
    };
    roles: { id: string; name: string; slug: string }[];
    projects: { id: string; slug: string; name: string }[];
    instances: { id: string; name: string }[];
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsAccessPoliciesListOutput =
  mtMap.object<DashboardOrganizationsAccessPoliciesListOutput>({
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
          type: mtMap.objectField('type', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          slug: mtMap.objectField('slug', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          document: mtMap.objectField(
            'document',
            mtMap.object({
              access: mtMap.objectField(
                'access',
                mtMap.array(
                  mtMap.object({
                    target: mtMap.objectField('target', mtMap.passthrough()),
                    scopes: mtMap.objectField(
                      'scopes',
                      mtMap.array(mtMap.passthrough())
                    ),
                    roles: mtMap.objectField(
                      'roles',
                      mtMap.array(mtMap.passthrough())
                    )
                  })
                )
              )
            })
          ),
          roles: mtMap.objectField(
            'roles',
            mtMap.array(
              mtMap.object({
                id: mtMap.objectField('id', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                slug: mtMap.objectField('slug', mtMap.passthrough())
              })
            )
          ),
          projects: mtMap.objectField(
            'projects',
            mtMap.array(
              mtMap.object({
                id: mtMap.objectField('id', mtMap.passthrough()),
                slug: mtMap.objectField('slug', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough())
              })
            )
          ),
          instances: mtMap.objectField(
            'instances',
            mtMap.array(
              mtMap.object({
                id: mtMap.objectField('id', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough())
              })
            )
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

export type DashboardOrganizationsAccessPoliciesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardOrganizationsAccessPoliciesListQuery = mtMap.union([
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

