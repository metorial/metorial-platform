import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationOutpostsListOutput = {
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

export let mapManagementOrganizationOutpostsListOutput =
  /* @__PURE__ */ createMapper<ManagementOrganizationOutpostsListOutput>(
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

export type ManagementOrganizationOutpostsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementOrganizationOutpostsListQuery =
  /* @__PURE__ */ createMapper<ManagementOrganizationOutpostsListQuery>(0);
