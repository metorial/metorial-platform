import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsAccessPoliciesUpdateOutput = {
  object: 'management.access_policy';
  id: string;
  organizationId: string;
  type: 'everyone' | 'admin' | 'custom';
  name: string;
  slug: string;
  description: string | null;
  document: {
    access: {
      target: string;
      scopes?: string[] | undefined;
      roles?: string[] | undefined;
    }[];
  };
  roles: { id: string; name: string; slug: string }[];
  projects: { id: string; slug: string; name: string }[];
  instances: { id: string; name: string }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsAccessPoliciesUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsAccessPoliciesUpdateOutput>(
    ['organization_id', 'created_at', 'updated_at'],
    1
  );

export type DashboardOrganizationsAccessPoliciesUpdateBody = {
  name?: string | undefined;
  description?: string | null | undefined;
  document?:
    | {
        access: {
          target: string;
          scopes?: string[] | undefined;
          roles?: string[] | undefined;
        }[];
      }
    | undefined;
  message?: string | undefined;
};

export let mapDashboardOrganizationsAccessPoliciesUpdateBody =
  /* @__PURE__ */ createMapper<DashboardOrganizationsAccessPoliciesUpdateBody>(
    0
  );
