import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationOauthAppsClientSecretsDeleteOutput = {
  object: 'machine_access.oauth_application_client_secret';
  id: string;
  preview: string;
  secret: string | null;
  createdAt: Date;
  deletedAt: Date | null;
};

export let mapManagementOrganizationOauthAppsClientSecretsDeleteOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationOauthAppsClientSecretsDeleteOutput>(
    ['created_at', 'deleted_at'],
    1
  );
