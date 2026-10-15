import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationServiceAccountsClientSecretsDeleteOutput = {
  object: 'machine_access.oauth_application_client_secret';
  id: string;
  preview: string;
  secret: string | null;
  createdAt: Date;
  deletedAt: Date | null;
};

export let mapManagementOrganizationServiceAccountsClientSecretsDeleteOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationServiceAccountsClientSecretsDeleteOutput>(
    ['created_at', 'deleted_at'],
    1
  );
