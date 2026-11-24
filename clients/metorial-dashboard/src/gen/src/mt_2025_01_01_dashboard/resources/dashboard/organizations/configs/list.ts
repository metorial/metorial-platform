import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsConfigsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsConfigsListOutput =
  /* @__PURE__ */ createMapper<DashboardOrganizationsConfigsListOutput>(
    [
      7,
      [
        1,
        [
          'config_type_id',
          'user_id',
          'organization_id',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );
