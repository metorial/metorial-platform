import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceMonitorsGetOutput = {
  object: 'monitor';
  id: string;
  name: string;
  description: string | null;
  target: 'protoguard_filter' | 'schema_change';
  status: 'active' | 'inactive';
  owner: 'organization' | 'system';
  protoGuardFilterId: string | null;
  providerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  firstAlertAt: Date | null;
  lastAlertAt: Date | null;
};

export let mapManagementInstanceMonitorsGetOutput =
  mtMap.object<ManagementInstanceMonitorsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    target: mtMap.objectField('target', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    owner: mtMap.objectField('owner', mtMap.passthrough()),
    protoGuardFilterId: mtMap.objectField(
      'proto_guard_filter_id',
      mtMap.passthrough()
    ),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    firstAlertAt: mtMap.objectField('first_alert_at', mtMap.date()),
    lastAlertAt: mtMap.objectField('last_alert_at', mtMap.date())
  });

