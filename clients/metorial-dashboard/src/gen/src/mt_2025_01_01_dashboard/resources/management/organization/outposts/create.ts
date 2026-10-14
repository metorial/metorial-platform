import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationOutpostsCreateOutput = {
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

export let mapManagementOrganizationOutpostsCreateOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationOutpostsCreateOutput>(
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

export type ManagementOrganizationOutpostsCreateBody = {
  name: string;
  description?: string | undefined;
};

export let mapManagementOrganizationOutpostsCreateBody =
  /* @__PURE__ */ createMapper<ManagementOrganizationOutpostsCreateBody>(0);
