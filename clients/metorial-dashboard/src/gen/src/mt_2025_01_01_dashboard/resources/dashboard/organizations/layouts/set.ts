import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsLayoutsSetOutput = {
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

export let mapDashboardOrganizationsLayoutsSetOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsLayoutsSetOutput>(
    [
      'layout_type_id',
      'user_id',
      'organization_id',
      'created_at',
      'updated_at'
    ],
    1
  );

export type DashboardOrganizationsLayoutsSetBody = { value: any };

export let mapDashboardOrganizationsLayoutsSetBody =
  /* @__PURE__ */ createMapper<DashboardOrganizationsLayoutsSetBody>(0);
