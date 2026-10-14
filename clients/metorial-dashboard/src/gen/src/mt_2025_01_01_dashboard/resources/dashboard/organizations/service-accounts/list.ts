import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsServiceAccountsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsServiceAccountsListOutput =
  /* @__PURE__ */ createMapper<DashboardOrganizationsServiceAccountsListOutput>(
    [
      7,
      [
        1,
        [
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

export type DashboardOrganizationsServiceAccountsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { status?: 'active' | 'archived' | ('active' | 'archived')[] | undefined };

export let mapDashboardOrganizationsServiceAccountsListQuery =
  /* @__PURE__ */ createMapper<DashboardOrganizationsServiceAccountsListQuery>(
    0
  );
