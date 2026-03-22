import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsServiceAccountsClientSecretsDeleteOutput = {
  object: 'machine_access.oauth_application_client_secret';
  id: string;
  preview: string;
  secret: string | null;
  createdAt: Date;
  deletedAt: Date | null;
};

export let mapDashboardOrganizationsServiceAccountsClientSecretsDeleteOutput =
  mtMap.object<DashboardOrganizationsServiceAccountsClientSecretsDeleteOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    preview: mtMap.objectField('preview', mtMap.passthrough()),
    secret: mtMap.objectField('secret', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    deletedAt: mtMap.objectField('deleted_at', mtMap.date())
  });

