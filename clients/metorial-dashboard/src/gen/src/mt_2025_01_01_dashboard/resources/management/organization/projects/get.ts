import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationProjectsGetOutput = {
  object: 'organization.project';
  id: string;
  status: 'active' | 'deleted';
  slug: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementOrganizationProjectsGetOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationProjectsGetOutput>(
    ['organization_id', 'created_at', 'updated_at'],
    1
  );
