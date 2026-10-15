import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsServiceAccountsCredentialsListOutput = {
  items: {
    object: 'machine_access.service_account_credential';
    id: string;
    status: 'active' | 'revoked';
    serviceAccountId: string;
    scopes: { identifier: string; name: string; description: string }[];
    machineAccess: {
      object: 'machine_access';
      id: string;
      status: 'active' | 'deleted';
      type:
        | 'organization_management'
        | 'instance_secret'
        | 'instance_publishable';
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
    lastUsedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsServiceAccountsCredentialsListOutput =
  /* @__PURE__ */ createMapper<DashboardOrganizationsServiceAccountsCredentialsListOutput>(
    [
      7,
      [
        1,
        [
          'service_account_id',
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
                  [
                    1,
                    [
                      'image_url',
                      'magic_mcp_origin',
                      'created_at',
                      'updated_at'
                    ]
                  ]
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
          'last_used_at',
          'revoked_at',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type DashboardOrganizationsServiceAccountsCredentialsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { status?: 'active' | 'revoked' | ('active' | 'revoked')[] | undefined };

export let mapDashboardOrganizationsServiceAccountsCredentialsListQuery =
  /* @__PURE__ */ createMapper<DashboardOrganizationsServiceAccountsCredentialsListQuery>(
    0
  );
