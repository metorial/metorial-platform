import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsOauthInstallationsRevokeOutput = {
  object: 'machine_access.oauth_installation';
  id: string;
  status: 'active' | 'revoked';
  scopes: { identifier: string; name: string; description: string }[];
  organizationId: string;
  oauthApplication: {
    object: 'machine_access.oauth_application';
    id: string;
    status: 'active' | 'archived';
    type: 'user_facing' | 'cli_auth' | 'server_side';
    accessLevel: 'organization' | 'global';
    subjectType:
      'organization_member' | 'consumer' | 'consumer_or_organization_member';
    allowTokenExchangeWithoutClientSecret: boolean;
    name: string;
    description: string | null;
    scopes: { identifier: string; name: string; description: string }[];
    imageUrl: string;
    websiteUrl: string | null;
    privacyPolicyUrl: string | null;
    termsOfServiceUrl: string | null;
    redirectUris: string[];
    clientId: string;
    clientSecrets: {
      object: 'machine_access.oauth_application_client_secret';
      id: string;
      preview: string;
      secret: string | null;
      createdAt: Date;
      deletedAt: Date | null;
    }[];
    organizationId: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  serverSideMachineAccess: {
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
  } | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsOauthInstallationsRevokeOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsOauthInstallationsRevokeOutput>(
    [
      'organization_id',
      [
        'oauth_application',
        1,
        [
          1,
          [
            'access_level',
            'subject_type',
            'allow_token_exchange_without_client_secret',
            'image_url',
            'website_url',
            'privacy_policy_url',
            'terms_of_service_url',
            'redirect_uris',
            'client_id',
            ['client_secrets', 1, [2, [1, ['created_at', 'deleted_at']]]],
            'organization_id',
            'created_at',
            'updated_at'
          ]
        ]
      ],
      [
        'server_side_machine_access',
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
      'last_used_at',
      'revoked_at',
      'created_at',
      'updated_at'
    ],
    1
  );
