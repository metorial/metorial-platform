import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceMonitorAlertsResolveOutput = {
  object: 'monitor.alert';
  id: string;
  status: 'pending' | 'resolved' | 'ignored';
  monitor: {
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
  protoGuardAlertId: string | null;
  protoGuardRunId: string | null;
  specificationChangeNotification: {
    object: 'provider.specification_change_notification';
    id: string;
    providerId: string;
    providerVersionId: string;
    fromSpecification: {
      object: 'provider.capabilities.specification#preview';
      id: string;
      name: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    toSpecification: {
      object: 'provider.capabilities.specification#preview';
      id: string;
      name: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    fromProviderVersion: {
      object: 'provider.version#preview';
      id: string;
      version: string;
      name: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    toProviderVersion: {
      object: 'provider.version#preview';
      id: string;
      version: string;
      name: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    createdAt: Date;
  } | null;
  createdAt: Date;
  resolvedAt: Date | null;
  recipients: {
    object: 'monitor.alert_recipient';
    id: string;
    recipientId: string;
    viewedAt: Date | null;
    createdAt: Date;
  }[];
  events: {
    object: 'monitor.alert_event';
    id: string;
    type: 'created' | 'viewed' | 'resolved' | 'unresolved';
    actorId: string | null;
    createdAt: Date;
  }[];
};

export let mapManagementInstanceMonitorAlertsResolveOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceMonitorAlertsResolveOutput>(
    [
      [
        'monitor',
        0,
        [
          1,
          [
            'proto_guard_filter_id',
            'provider_id',
            'created_at',
            'updated_at',
            'first_alert_at',
            'last_alert_at'
          ]
        ]
      ],
      'proto_guard_alert_id',
      'proto_guard_run_id',
      [
        'specification_change_notification',
        1,
        [
          1,
          [
            'provider_id',
            'provider_version_id',
            ['from_specification', 1, 8],
            ['to_specification', 1, 8],
            ['from_provider_version', 1, 8],
            ['to_provider_version', 1, 8],
            'created_at'
          ]
        ]
      ],
      'created_at',
      'resolved_at',
      ['recipients', 0, [2, [1, ['recipient_id', 'viewed_at', 'created_at']]]],
      ['events', 0, [2, [1, ['actor_id', 'created_at']]]]
    ],
    1
  );
