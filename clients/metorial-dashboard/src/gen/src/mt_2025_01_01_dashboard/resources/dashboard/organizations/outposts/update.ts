import { mtMap } from '@metorial/util-resource-mapper';

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
  mtMap.object<DashboardOrganizationsOutpostsUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    connectionStatus: mtMap.objectField(
      'connection_status',
      mtMap.passthrough()
    ),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    instanceCount: mtMap.objectField('instance_count', mtMap.passthrough()),
    lastSeenAt: mtMap.objectField('last_seen_at', mtMap.date()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardOrganizationsOutpostsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
};

export let mapDashboardOrganizationsOutpostsUpdateBody =
  mtMap.object<DashboardOrganizationsOutpostsUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough())
  });

