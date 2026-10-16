import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationInstancesUpdateOutput = {
  object: 'organization.instance';
  id: string;
  slug: string;
  name: string;
  organizationId: string;
  sandboxId: string | null;
  type: 'development' | 'production';
  createdAt: Date;
  updatedAt: Date;
  project: {
    object: 'organization.project';
    id: string;
    status: 'active' | 'deleted';
    slug: string;
    name: string;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  };
};

export let mapManagementOrganizationInstancesUpdateOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationInstancesUpdateOutput>(
    [
      'organization_id',
      'sandbox_id',
      'created_at',
      'updated_at',
      ['project', 0, [1, ['organization_id', 'created_at', 'updated_at']]]
    ],
    1
  );

export type ManagementOrganizationInstancesUpdateBody = {
  name?: string | undefined;
};

export let mapManagementOrganizationInstancesUpdateBody =
  /* @__PURE__ */ createMapper<ManagementOrganizationInstancesUpdateBody>(0);
