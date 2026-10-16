import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsOauthAppsListOutput = {
  items: {
    object: 'machine_access.oauth_application';
    id: string;
    status: 'active' | 'archived';
    type: 'user_facing' | 'cli_auth' | 'server_side';
    accessLevel: 'organization' | 'global';
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsOauthAppsListOutput =
  /* @__PURE__ */ createMapper<DashboardOrganizationsOauthAppsListOutput>(
    [
      7,
      [
        1,
        [
          'access_level',
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
    1
  );

export type DashboardOrganizationsOauthAppsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { status?: 'active' | 'archived' | ('active' | 'archived')[] | undefined };

export let mapDashboardOrganizationsOauthAppsListQuery =
  /* @__PURE__ */ createMapper<DashboardOrganizationsOauthAppsListQuery>(0);
