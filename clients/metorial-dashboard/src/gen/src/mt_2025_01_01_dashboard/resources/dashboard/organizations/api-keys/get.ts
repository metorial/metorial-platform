import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsApiKeysGetOutput = {
  object: 'machine_access.api_key';
  id: string;
  status: 'active' | 'deleted';
  secretRedacted: string;
  secretRedactedLong: string;
  secret: string | null;
  type:
    | 'organization_management_token'
    | 'instance_access_token_secret'
    | 'instance_access_token_publishable';
  name: string;
  description: string | null;
  ipFilters: string[];
  machineAccess: {
    object: 'machine_access';
    id: string;
    status: 'active' | 'deleted';
    type:
      | 'organization_management'
      | 'instance_secret'
      | 'instance_publishable'
      | 'instance_consumer';
    name: string;
    lastUsedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
    actor: {
      object: 'organization.actor';
      id: string;
      type: 'member' | 'machine_access';
      organizationId: string;
      name: string;
      email: string | null;
      imageUrl: string;
      member: {
        object: 'organization.member#preview';
        id: string;
        status: 'active' | 'deleted';
        role: 'member' | 'admin';
      } | null;
      teams: {
        id: string;
        name: string;
        slug: string;
        assignmentId: string;
        createdAt: Date;
        updatedAt: Date;
      }[];
      createdAt: Date;
      updatedAt: Date;
    } | null;
    instance: {
      object: 'organization.instance';
      id: string;
      slug: string;
      name: string;
      organizationId: string;
      sandboxId: string | null;
      type: 'development' | 'production';
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
    } | null;
    organization: {
      object: 'organization';
      id: string;
      type: 'default';
      slug: string;
      name: string;
      imageUrl: string;
      magicMcpOrigin: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
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
    } | null;
  };
  deletedAt: Date | null;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  revealInfo: { until: Date; forever: boolean } | null;
};

export let mapDashboardOrganizationsApiKeysGetOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsApiKeysGetOutput>(
    [
      'secret_redacted',
      'secret_redacted_long',
      'ip_filters',
      [
        'machine_access',
        1,
        [
          1,
          [
            'last_used_at',
            'created_at',
            'updated_at',
            'deleted_at',
            [
              'actor',
              0,
              [
                1,
                [
                  'organization_id',
                  'image_url',
                  [
                    'teams',
                    0,
                    [2, [1, ['assignment_id', 'created_at', 'updated_at']]]
                  ],
                  'created_at',
                  'updated_at'
                ]
              ]
            ],
            [
              'instance',
              0,
              [
                1,
                [
                  'organization_id',
                  'sandbox_id',
                  'created_at',
                  'updated_at',
                  [
                    'project',
                    0,
                    [1, ['organization_id', 'created_at', 'updated_at']]
                  ]
                ]
              ]
            ],
            [
              'organization',
              0,
              [1, ['image_url', 'magic_mcp_origin', 'created_at', 'updated_at']]
            ],
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
      'deleted_at',
      'last_used_at',
      'expires_at',
      'created_at',
      'updated_at',
      ['reveal_info', 1, [1, [['until', 0, 4]]]]
    ],
    1
  );
