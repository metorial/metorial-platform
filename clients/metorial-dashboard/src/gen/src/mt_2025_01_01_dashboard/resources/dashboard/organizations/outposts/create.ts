import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsOutpostsCreateOutput = {
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
};

export let mapDashboardOrganizationsOutpostsCreateOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsOutpostsCreateOutput>(
    [
      'connection_status',
      'organization_id',
      'instance_count',
      'last_seen_at',
      'created_at',
      'updated_at'
    ],
    1
  );

export type DashboardOrganizationsOutpostsCreateBody = {
  name: string;
  description?: string | undefined;
};

export let mapDashboardOrganizationsOutpostsCreateBody =
  /* @__PURE__ */ createMapper<DashboardOrganizationsOutpostsCreateBody>(0);
