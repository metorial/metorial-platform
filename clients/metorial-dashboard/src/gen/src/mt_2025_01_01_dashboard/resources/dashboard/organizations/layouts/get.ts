import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsLayoutsGetOutput = {
  object: 'organization.layout';
  id: string;
  layoutTypeId: string;
  identifier: string;
  name: string;
  ownership: 'user' | 'organization' | 'user_organization';
  userId: string | null;
  organizationId: string | null;
  value: any;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsLayoutsGetOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsLayoutsGetOutput>(
    [
      'layout_type_id',
      'user_id',
      'organization_id',
      'created_at',
      'updated_at'
    ],
    1
  );
