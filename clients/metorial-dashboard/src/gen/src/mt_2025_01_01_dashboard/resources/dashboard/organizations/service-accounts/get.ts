import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsServiceAccountsGetOutput = {
  object: 'machine_access.service_account';
  id: string;
  status: 'active' | 'archived';
  name: string;
  description: string | null;
  scopes: { identifier: string; name: string; description: string }[];
  clientId: string;
  policies: {
    object: 'management.access_policy#preview';
    id: string;
    type: 'everyone' | 'admin' | 'custom';
    name: string;
    slug: string;
  }[];
  clientSecrets: {
    object: 'machine_access.oauth_application_client_secret';
    id: string;
    preview: string;
    secret: string | null;
    createdAt: Date;
    deletedAt: Date | null;
  }[];
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsServiceAccountsGetOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsServiceAccountsGetOutput>(
    [
      'client_id',
      ['client_secrets', 1, [2, [1, ['created_at', 'deleted_at']]]],
      'organization_id',
      'created_at',
      'updated_at'
    ],
    1
  );
