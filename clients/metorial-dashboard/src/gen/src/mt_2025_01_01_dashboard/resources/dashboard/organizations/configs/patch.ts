import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsConfigsPatchOutput = {
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

export let mapDashboardOrganizationsConfigsPatchOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsConfigsPatchOutput>(
    [
      'config_type_id',
      'user_id',
      'organization_id',
      'created_at',
      'updated_at'
    ],
    1
  );

export type DashboardOrganizationsConfigsPatchBody = {
  operations: (
    | { op: 'set'; path: string[]; value: any }
    | { op: 'unset'; path: string[] }
    | { op: 'add'; path: string[]; value: any }
    | { op: 'remove'; path: string[]; value: any }
  )[];
};

export let mapDashboardOrganizationsConfigsPatchBody =
  /* @__PURE__ */ createMapper<DashboardOrganizationsConfigsPatchBody>(0);
