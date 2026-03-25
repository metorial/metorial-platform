import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationAccessRolesVersionsOutput = {
  items: {
    object: 'management.access_role_version';
    id: string;
    accessRoleId: string;
    index: number;
    scopes: string[];
    scopesAdded: string[];
    scopesRemoved: string[];
    message: string | null;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementOrganizationAccessRolesVersionsOutput =
  mtMap.object<ManagementOrganizationAccessRolesVersionsOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          accessRoleId: mtMap.objectField(
            'access_role_id',
            mtMap.passthrough()
          ),
          index: mtMap.objectField('index', mtMap.passthrough()),
          scopes: mtMap.objectField('scopes', mtMap.array(mtMap.passthrough())),
          scopesAdded: mtMap.objectField(
            'scopes_added',
            mtMap.array(mtMap.passthrough())
          ),
          scopesRemoved: mtMap.objectField(
            'scopes_removed',
            mtMap.array(mtMap.passthrough())
          ),
          message: mtMap.objectField('message', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date())
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

export type ManagementOrganizationAccessRolesVersionsQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementOrganizationAccessRolesVersionsQuery = mtMap.union([
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

