import { createMapper } from '@metorial/util-resource-mapper/compact';

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
      type: 'user' | 'consumer';
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
  /* @__PURE__ */ createMapper<DashboardOrganizationsOauthCliDevicesListOutput>(
    [
      7,
      [
        1,
        [
          'organization_id',
          'oauth_authorization_id',
          'created_at',
          'updated_at',
          [
            'user',
            0,
            [
              1,
              [
                'first_name',
                'last_name',
                'image_url',
                'created_at',
                'updated_at'
              ]
            ]
          ]
        ]
      ]
    ],
    1
  );

export type DashboardOrganizationsOauthCliDevicesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardOrganizationsOauthCliDevicesListQuery =
  /* @__PURE__ */ createMapper<DashboardOrganizationsOauthCliDevicesListQuery>(
    0
  );
