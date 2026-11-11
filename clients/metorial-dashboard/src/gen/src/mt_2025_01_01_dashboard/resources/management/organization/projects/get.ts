import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationProjectsGetOutput = {
  object: 'organization.project';
  id: string;
  status: 'active' | 'deleted';
  slug: string;
  name: string;
  assistantEnabled: boolean;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementOrganizationProjectsGetOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationProjectsGetOutput>(
    ['assistant_enabled', 'organization_id', 'created_at', 'updated_at'],
    1
  );
