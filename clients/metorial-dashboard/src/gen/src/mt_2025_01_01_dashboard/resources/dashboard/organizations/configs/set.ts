import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsConfigsSetOutput = {
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

export let mapDashboardOrganizationsConfigsSetOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsConfigsSetOutput>(
    [
      'config_type_id',
      'user_id',
      'organization_id',
      'created_at',
      'updated_at'
    ],
    1
  );

export type DashboardOrganizationsConfigsSetBody = { value: any };

export let mapDashboardOrganizationsConfigsSetBody =
  /* @__PURE__ */ createMapper<DashboardOrganizationsConfigsSetBody>(0);
