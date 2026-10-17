import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsOauthAppsUpdateOutput = {
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

export let mapDashboardOrganizationsOauthAppsUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsOauthAppsUpdateOutput>(
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

export type DashboardOrganizationsOauthAppsUpdateBody = {
  accessLevel?: 'organization' | undefined;
  allowTokenExchangeWithoutClientSecret?: boolean | undefined;
  name?: string | undefined;
  description?: string | null | undefined;
  websiteUrl?: string | null | undefined;
  privacyPolicyUrl?: string | null | undefined;
  termsOfServiceUrl?: string | null | undefined;
  redirectUris?: string[] | undefined;
  scopes?: string[] | undefined;
};

export let mapDashboardOrganizationsOauthAppsUpdateBody =
  /* @__PURE__ */ mapObject<DashboardOrganizationsOauthAppsUpdateBody>([
    'access_level',
    'allow_token_exchange_without_client_secret',
    'website_url',
    'privacy_policy_url',
    'terms_of_service_url',
    'redirect_uris'
  ]);
