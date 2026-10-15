import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationOutpostsUpdateOutput = {
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

export let mapManagementOrganizationOutpostsUpdateOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationOutpostsUpdateOutput>(
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

export type ManagementOrganizationOutpostsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
};

export let mapManagementOrganizationOutpostsUpdateBody =
  /* @__PURE__ */ createMapper<ManagementOrganizationOutpostsUpdateBody>(0);
