import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsOauthAppsCreateOutput = {
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

export let mapDashboardOrganizationsOauthAppsCreateOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsOauthAppsCreateOutput>(
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
    ],
    1
  );

export type DashboardOrganizationsOauthAppsCreateBody = {
  accessLevel: 'organization';
  subjectType?: 'organization_member' | 'consumer' | undefined;
  allowTokenExchangeWithoutClientSecret?: boolean | undefined;
  name: string;
  description?: string | undefined;
  websiteUrl?: string | undefined;
  privacyPolicyUrl?: string | undefined;
  termsOfServiceUrl?: string | undefined;
  redirectUris?: string[] | undefined;
  scopes: string[];
};

export let mapDashboardOrganizationsOauthAppsCreateBody =
  /* @__PURE__ */ mapObject<DashboardOrganizationsOauthAppsCreateBody>([
    'access_level',
    'subject_type',
    'allow_token_exchange_without_client_secret',
    'website_url',
    'privacy_policy_url',
    'terms_of_service_url',
    'redirect_uris'
  ]);
