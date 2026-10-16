import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsLayoutsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsLayoutsListOutput =
  /* @__PURE__ */ createMapper<DashboardOrganizationsLayoutsListOutput>(
    [
      7,
      [
        1,
        [
          'layout_type_id',
          'user_id',
          'organization_id',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );
