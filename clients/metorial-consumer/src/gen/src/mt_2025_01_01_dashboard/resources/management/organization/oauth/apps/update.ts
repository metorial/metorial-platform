import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationOauthAppsUpdateOutput = {
  object: 'machine_access.oauth_application';
  id: string;
  status: 'active' | 'archived';
  type: 'user_facing' | 'cli_auth' | 'server_side';
  accessLevel: 'organization' | 'global';
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

export let mapManagementOrganizationOauthAppsUpdateOutput =
  mtMap.object<ManagementOrganizationOauthAppsUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    accessLevel: mtMap.objectField('access_level', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    scopes: mtMap.objectField(
      'scopes',
      mtMap.array(
        mtMap.object({
          identifier: mtMap.objectField('identifier', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough())
        })
      )
    ),
    imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
    websiteUrl: mtMap.objectField('website_url', mtMap.passthrough()),
    privacyPolicyUrl: mtMap.objectField(
      'privacy_policy_url',
      mtMap.passthrough()
    ),
    termsOfServiceUrl: mtMap.objectField(
      'terms_of_service_url',
      mtMap.passthrough()
    ),
    redirectUris: mtMap.objectField(
      'redirect_uris',
      mtMap.array(mtMap.passthrough())
    ),
    clientId: mtMap.objectField('client_id', mtMap.passthrough()),
    clientSecrets: mtMap.objectField(
      'client_secrets',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          preview: mtMap.objectField('preview', mtMap.passthrough()),
          secret: mtMap.objectField('secret', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          deletedAt: mtMap.objectField('deleted_at', mtMap.date())
        })
      )
    ),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementOrganizationOauthAppsUpdateBody = {
  accessLevel?: 'organization' | undefined;
  name?: string | undefined;
  description?: string | null | undefined;
  websiteUrl?: string | null | undefined;
  privacyPolicyUrl?: string | null | undefined;
  termsOfServiceUrl?: string | null | undefined;
  redirectUris?: string[] | undefined;
  scopes?: string[] | undefined;
};

export let mapManagementOrganizationOauthAppsUpdateBody =
  mtMap.object<ManagementOrganizationOauthAppsUpdateBody>({
    accessLevel: mtMap.objectField('access_level', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    websiteUrl: mtMap.objectField('website_url', mtMap.passthrough()),
    privacyPolicyUrl: mtMap.objectField(
      'privacy_policy_url',
      mtMap.passthrough()
    ),
    termsOfServiceUrl: mtMap.objectField(
      'terms_of_service_url',
      mtMap.passthrough()
    ),
    redirectUris: mtMap.objectField(
      'redirect_uris',
      mtMap.array(mtMap.passthrough())
    ),
    scopes: mtMap.objectField('scopes', mtMap.array(mtMap.passthrough()))
  });

