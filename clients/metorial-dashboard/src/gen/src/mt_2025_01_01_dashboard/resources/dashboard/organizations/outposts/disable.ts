import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsOutpostsDisableOutput = {
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

export let mapDashboardOrganizationsOutpostsDisableOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsOutpostsDisableOutput>(
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
