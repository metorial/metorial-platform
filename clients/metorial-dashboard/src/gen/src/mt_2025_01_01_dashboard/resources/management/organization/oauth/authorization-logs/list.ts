import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationOauthAuthorizationLogsListOutput = {
  items: {
    object: 'machine_access.oauth_authorization_log';
    id: string;
    status: 'pending' | 'accepted';
    type: 'interactive' | 'device_code';
    organizationId: string;
    redirectUri: string | null;
    clientIp: string | null;
    scopes: { identifier: string; name: string; description: string }[];
    oauthApplication: {
      object: 'machine_access.oauth_application';
      id: string;
      status: 'active' | 'archived';
      type: 'user_facing' | 'cli_auth' | 'server_side';
      accessLevel: 'organization' | 'global';
      subjectType:
        | 'organization_member'
        | 'consumer'
        | 'consumer_or_organization_member';
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
    createdAt: Date;
    acceptedAt: Date | null;
    deniedAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementOrganizationOauthAuthorizationLogsListOutput =
  /* @__PURE__ */ createMapper<ManagementOrganizationOauthAuthorizationLogsListOutput>(
    [
      7,
      [
        1,
        [
          'organization_id',
          'redirect_uri',
          'client_ip',
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
          ],
          'created_at',
          'accepted_at',
          'denied_at'
        ]
      ]
    ],
    1
  );

export type ManagementOrganizationOauthAuthorizationLogsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  appId?: string | string[] | undefined;
  userId?: string | string[] | undefined;
};

export let mapManagementOrganizationOauthAuthorizationLogsListQuery =
  /* @__PURE__ */ createMapper<ManagementOrganizationOauthAuthorizationLogsListQuery>(
    [3, [[0, [1, ['app_id', 'user_id']]]]]
  );
