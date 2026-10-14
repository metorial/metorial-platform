import { mapObject } from '@metorial/util-resource-mapper/compact';

export type MonitorsGetOutput = {
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

export let mapMonitorsGetOutput = /* @__PURE__ */ mapObject<MonitorsGetOutput>(
  [
    'proto_guard_filter_id',
    'provider_id',
    'created_at',
    'updated_at',
    'first_alert_at',
    'last_alert_at'
  ],
  1
);
