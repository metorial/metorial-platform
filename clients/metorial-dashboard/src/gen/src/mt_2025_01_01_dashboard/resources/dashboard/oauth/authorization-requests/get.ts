import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOauthAuthorizationRequestsGetOutput = {
  object: 'machine_access.oauth_authorization_request';
  id: string;
  status: 'pending' | 'accepted' | 'denied' | 'consumed';
  type: 'interactive' | 'device_code';
  subjectType: 'organization_member' | 'consumer';
  userCode: string | null;
  redirectUri: string | null;
  scopes: { identifier: string; name: string; description: string }[];
  redirectUrl: string | null;
  createdAt: Date;
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
};

export let mapDashboardOauthAuthorizationRequestsGetOutput =
  /* @__PURE__ */ mapObject<DashboardOauthAuthorizationRequestsGetOutput>(
    [
      'subject_type',
      'user_code',
      'redirect_uri',
      'redirect_url',
      'created_at',
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
      ]
    ],
    1
  );
