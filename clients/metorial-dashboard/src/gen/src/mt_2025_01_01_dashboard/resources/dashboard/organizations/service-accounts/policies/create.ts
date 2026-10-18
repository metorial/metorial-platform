import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsServiceAccountsPoliciesCreateOutput = {
  object: 'machine_access.service_account';
  id: string;
  status: 'active' | 'archived';
  subjectType: 'organization_member' | 'consumer';
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
  portalId: string | null;
  consumerProfileId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsServiceAccountsPoliciesCreateOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsServiceAccountsPoliciesCreateOutput>(
    [
      'subject_type',
      'client_id',
      ['client_secrets', 1, [2, [1, ['created_at', 'deleted_at']]]],
      'organization_id',
      'portal_id',
      'consumer_profile_id',
      'created_at',
      'updated_at'
    ],
    1
  );

export type DashboardOrganizationsServiceAccountsPoliciesCreateBody = {
  accessPolicyId: string;
};

export let mapDashboardOrganizationsServiceAccountsPoliciesCreateBody =
  /* @__PURE__ */ mapObject<DashboardOrganizationsServiceAccountsPoliciesCreateBody>(
    ['access_policy_id']
  );
