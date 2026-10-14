import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationProjectsDeleteOutput = {
  object: 'organization.project';
  id: string;
  status: 'active' | 'deleted';
  slug: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementOrganizationProjectsDeleteOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationProjectsDeleteOutput>(
    ['organization_id', 'created_at', 'updated_at'],
    1
  );
