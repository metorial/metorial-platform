import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsOauthCliDevicesListOutput = {
  items: {
    object: 'machine_access.cli_device';
    id: string;
    ip: string;
    organizationId: string;
    oauthAuthorizationId: string;
    createdAt: Date;
    updatedAt: Date;
    user: {
      object: 'user';
      id: string;
      status: 'active' | 'deleted';
      type: 'user';
      email: string;
      name: string;
      firstName: string;
      lastName: string;
      imageUrl: string;
      createdAt: Date;
      updatedAt: Date;
    };
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsOauthCliDevicesListOutput =
  mtMap.object<DashboardOrganizationsOauthCliDevicesListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          ip: mtMap.objectField('ip', mtMap.passthrough()),
          organizationId: mtMap.objectField(
            'organization_id',
            mtMap.passthrough()
          ),
          oauthAuthorizationId: mtMap.objectField(
            'oauth_authorization_id',
            mtMap.passthrough()
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date()),
          user: mtMap.objectField(
            'user',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              type: mtMap.objectField('type', mtMap.passthrough()),
              email: mtMap.objectField('email', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              firstName: mtMap.objectField('first_name', mtMap.passthrough()),
              lastName: mtMap.objectField('last_name', mtMap.passthrough()),
              imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          )
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

export type DashboardOrganizationsOauthCliDevicesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardOrganizationsOauthCliDevicesListQuery = mtMap.union([
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

