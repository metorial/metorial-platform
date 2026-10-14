import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsConfigsGetOutput = {
  object: 'organization.config';
  id: string;
  configTypeId: string;
  identifier: string;
  name: string;
  ownership: 'user' | 'organization' | 'user_organization';
  userId: string | null;
  organizationId: string | null;
  value: any;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsConfigsGetOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsConfigsGetOutput>(
    [
      'config_type_id',
      'user_id',
      'organization_id',
      'created_at',
      'updated_at'
    ],
    1
  );
