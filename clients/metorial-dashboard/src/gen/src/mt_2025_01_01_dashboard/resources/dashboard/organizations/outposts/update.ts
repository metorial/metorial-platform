import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsOutpostsUpdateOutput = {
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

export let mapDashboardOrganizationsOutpostsUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsOutpostsUpdateOutput>(
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

export type DashboardOrganizationsOutpostsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
};

export let mapDashboardOrganizationsOutpostsUpdateBody =
  /* @__PURE__ */ createMapper<DashboardOrganizationsOutpostsUpdateBody>(0);
