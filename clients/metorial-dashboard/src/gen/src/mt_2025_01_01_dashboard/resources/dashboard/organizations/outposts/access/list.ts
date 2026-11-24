import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsOutpostsAccessListOutput = {
  items: {
    object: 'outpost_access';
    id: string;
    outpostId: string;
    projectId: string;
    instanceId: string;
    organizationId: string;
    services: ('mcp_connection_proxy' | 'outpost_registration_proxy')[];
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsOutpostsAccessListOutput =
  /* @__PURE__ */ createMapper<DashboardOrganizationsOutpostsAccessListOutput>(
    [
      7,
      [
        1,
        [
          'outpost_id',
          'project_id',
          'instance_id',
          'organization_id',
          'created_at'
        ]
      ]
    ],
    1
  );

export type DashboardOrganizationsOutpostsAccessListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { organizationId?: string | undefined; instanceId?: string | undefined };

export let mapDashboardOrganizationsOutpostsAccessListQuery =
  /* @__PURE__ */ createMapper<DashboardOrganizationsOutpostsAccessListQuery>([
    3,
    [[0, [1, ['organization_id', 'instance_id']]]]
  ]);
