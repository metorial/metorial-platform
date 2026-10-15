import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationOauthCliDevicesGetOutput = {
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
};

export let mapManagementOrganizationOauthCliDevicesGetOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationOauthCliDevicesGetOutput>(
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
          ['first_name', 'last_name', 'image_url', 'created_at', 'updated_at']
        ]
      ]
    ],
    1
  );
