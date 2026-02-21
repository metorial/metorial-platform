import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationTeamsListOutput = {
  items: {
    object: 'management.team';
    id: string;
    organizationId: string;
    name: string;
    slug: string;
    description: string | null;
    projects: {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      project: {
        object: 'organization.project';
        id: string;
        status: 'active' | 'deleted';
        slug: string;
        name: string;
        organizationId: string;
        createdAt: Date;
        updatedAt: Date;
      };
      roles: {
        id: string;
        role: {
          object: 'management.team.role';
          id: string;
          organizationId: string;
          name: string;
          slug: string;
          description: string | null;
          permissions: string[];
          createdAt: Date;
          updatedAt: Date;
        };
        createdAt: Date;
        updatedAt: Date;
      }[];
    }[];
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementOrganizationTeamsListOutput =
  mtMap.object<ManagementOrganizationTeamsListOutput>({
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
          projects: mtMap.objectField(
            'projects',
            mtMap.array(
              mtMap.object({
                id: mtMap.objectField('id', mtMap.passthrough()),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date()),
                project: mtMap.objectField(
                  'project',
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    status: mtMap.objectField('status', mtMap.passthrough()),
                    slug: mtMap.objectField('slug', mtMap.passthrough()),
                    name: mtMap.objectField('name', mtMap.passthrough()),
                    organizationId: mtMap.objectField(
                      'organization_id',
                      mtMap.passthrough()
                    ),
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date())
                  })
                ),
                roles: mtMap.objectField(
                  'roles',
                  mtMap.array(
                    mtMap.object({
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      role: mtMap.objectField(
                        'role',
                        mtMap.object({
                          object: mtMap.objectField(
                            'object',
                            mtMap.passthrough()
                          ),
                          id: mtMap.objectField('id', mtMap.passthrough()),
                          organizationId: mtMap.objectField(
                            'organization_id',
                            mtMap.passthrough()
                          ),
                          name: mtMap.objectField('name', mtMap.passthrough()),
                          slug: mtMap.objectField('slug', mtMap.passthrough()),
                          description: mtMap.objectField(
                            'description',
                            mtMap.passthrough()
                          ),
                          permissions: mtMap.objectField(
                            'permissions',
                            mtMap.array(mtMap.passthrough())
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
                      createdAt: mtMap.objectField('created_at', mtMap.date()),
                      updatedAt: mtMap.objectField('updated_at', mtMap.date())
                    })
                  )
                )
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

export type ManagementOrganizationTeamsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementOrganizationTeamsListQuery = mtMap.union([
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

