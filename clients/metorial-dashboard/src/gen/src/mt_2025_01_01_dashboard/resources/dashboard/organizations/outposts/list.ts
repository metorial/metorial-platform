import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsOutpostsListOutput = {
  items: {
    object: 'outpost';
    id: string;
    status: 'active' | 'disabled' | 'deleted';
    connectionStatus: 'active' | 'inactive';
    organizationId: string;
    name: string;
    description: string | null;
    instanceCount: number;
    lastSeenAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsOutpostsListOutput =
  /* @__PURE__ */ createMapper<DashboardOrganizationsOutpostsListOutput>(
    [
      7,
      [
        1,
        [
          'connection_status',
          'organization_id',
          'instance_count',
          'last_seen_at',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type DashboardOrganizationsOutpostsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardOrganizationsOutpostsListQuery =
  /* @__PURE__ */ createMapper<DashboardOrganizationsOutpostsListQuery>(0);
